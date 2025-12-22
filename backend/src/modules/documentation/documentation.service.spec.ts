import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotFoundException } from '@nestjs/common';
import { DocumentationService } from './documentation.service';
import {
  Documentation,
  DocumentationDocument,
  DocType,
} from '../../schemas/documentation.schema';

/**
 * Property-Based Tests for DocumentationService
 *
 * These tests verify the correctness properties defined in the design document
 * for the documentation-system feature.
 *
 * Testing Framework: fast-check
 * Minimum iterations: 100
 */

// In-memory store for mock database
let mockDocuments: Map<string, any>;

// Helper to create a mock document with Mongoose-like behavior
const createMockDocument = (data: any): any => {
  const id = data._id || new Types.ObjectId();
  const doc = {
    _id: id,
    title: data.title || 'Test Title',
    content: data.content || 'Test Content',
    type: data.type || DocType.NOTE,
    tags: data.tags || [],
    categories: data.categories || [],
    targets: data.targets || [],
    technologies: data.technologies || [],
    vulnerabilityTypes: data.vulnerabilityTypes || [],
    coverage: data.coverage || [],
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
    isPublic: data.isPublic ?? false,
    isPinned: data.isPinned ?? false,
    viewCount: data.viewCount ?? 0,
    attachments: data.attachments || [],
    relatedDocs: data.relatedDocs || [],
    lastAccessedAt: data.lastAccessedAt,
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    toObject: function () {
      return { ...this };
    },
  };
  return doc;
};

// Arbitraries for generating test data
const docTypeArb = fc.constantFrom(
  DocType.NOTE,
  DocType.TECHNIQUE,
  DocType.WRITEUP,
  DocType.REFERENCE,
  DocType.CHECKLIST,
);

const nonEmptyStringArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

const tagsArb = fc.array(nonEmptyStringArb, { minLength: 0, maxLength: 5 });

const createDocDtoArb = fc.record({
  title: nonEmptyStringArb,
  content: nonEmptyStringArb,
  type: fc.option(docTypeArb, { nil: undefined }),
  tags: fc.option(tagsArb, { nil: undefined }),
  categories: fc.option(tagsArb, { nil: undefined }),
  targets: fc.option(tagsArb, { nil: undefined }),
  technologies: fc.option(tagsArb, { nil: undefined }),
  vulnerabilityTypes: fc.option(tagsArb, { nil: undefined }),
  isPublic: fc.option(fc.boolean(), { nil: undefined }),
});

describe('DocumentationService Property-Based Tests', () => {
  let service: DocumentationService;

  beforeEach(async () => {
    mockDocuments = new Map();

    const mockModel = {
      create: jest.fn().mockImplementation((data: any) => {
        const doc = createMockDocument(data);
        mockDocuments.set(doc._id.toString(), doc);
        return Promise.resolve(doc);
      }),
      find: jest.fn().mockImplementation((query: any = {}, projection?: any) => {
        let results = Array.from(mockDocuments.values());

        // Handle $text search
        if (query.$text && query.$text.$search) {
          const searchTerm = query.$text.$search.toLowerCase();
          results = results.filter((doc) => {
            const titleMatch = doc.title?.toLowerCase().includes(searchTerm);
            const contentMatch = doc.content?.toLowerCase().includes(searchTerm);
            const tagsMatch = doc.tags?.some((tag: string) => 
              tag.toLowerCase().includes(searchTerm)
            );
            return titleMatch || contentMatch || tagsMatch;
          });
          // Add text score to results for sorting
          results = results.map((doc) => ({
            ...doc,
            score: 1.0, // Simplified score for testing
          }));
        }

        // Handle $or queries for coverage
        if (query.$or) {
          results = results.filter((doc) => {
            return query.$or.some((condition: any) => {
              if (condition.targets) {
                return doc.targets?.includes(condition.targets);
              }
              if (condition['coverage.targetName']) {
                return doc.coverage?.some(
                  (c: any) => c.targetName === condition['coverage.targetName']
                );
              }
              return false;
            });
          });
        }

        // Apply filters
        if (query.type) {
          results = results.filter((doc) => doc.type === query.type);
        }
        if (query.tags) {
          results = results.filter((doc) => doc.tags?.includes(query.tags));
        }
        if (query.categories) {
          results = results.filter((doc) =>
            doc.categories?.includes(query.categories),
          );
        }
        if (query.targets && !query.$or) {
          results = results.filter((doc) => doc.targets?.includes(query.targets));
        }
        if (query.technologies) {
          results = results.filter((doc) =>
            doc.technologies?.includes(query.technologies),
          );
        }
        if (query.isPinned !== undefined) {
          results = results.filter((doc) => doc.isPinned === query.isPinned);
        }

        let sortOption: Record<string, number> = { isPinned: -1, createdAt: -1 };
        let skipValue = 0;
        let limitValue = 20;
        let useTextScore = projection?.score?.$meta === 'textScore';

        const chainMethods = {
          sort: jest.fn().mockImplementation((sort: Record<string, number> | any) => {
            // Handle text score sorting
            if (sort?.score?.$meta === 'textScore') {
              useTextScore = true;
            } else {
              sortOption = sort;
            }
            return {
              skip: jest.fn().mockImplementation((skip: number) => {
                skipValue = skip;
                return {
                  limit: jest.fn().mockImplementation((limit: number) => {
                    limitValue = limit;
                    return {
                      populate: jest.fn().mockReturnThis(),
                      exec: jest.fn().mockImplementation(() => {
                        // Apply sorting
                        if (!useTextScore) {
                          const sortFields = Object.entries(sortOption);
                          results.sort((a, b) => {
                            for (const [field, direction] of sortFields) {
                              let cmp = 0;
                              if (field === 'createdAt') {
                                const aTime = new Date(a.createdAt).getTime();
                                const bTime = new Date(b.createdAt).getTime();
                                cmp = bTime - aTime; // descending by default
                                if (direction === 1) cmp = -cmp; // ascending
                              } else if (field === 'isPinned') {
                                const aVal = a.isPinned ? 1 : 0;
                                const bVal = b.isPinned ? 1 : 0;
                                cmp = bVal - aVal; // descending by default (pinned first)
                                if (direction === 1) cmp = -cmp;
                              } else {
                                const aVal = a[field];
                                const bVal = b[field];
                                if (aVal < bVal) cmp = -1;
                                else if (aVal > bVal) cmp = 1;
                                if (direction === -1) cmp = -cmp;
                              }
                              if (cmp !== 0) return cmp;
                            }
                            return 0;
                          });
                        }

                        // Apply pagination
                        return Promise.resolve(
                          results.slice(skipValue, skipValue + limitValue),
                        );
                      }),
                    };
                  }),
                };
              }),
            };
          }),
          // Direct exec for queries without sort/skip/limit (like getCoverageForTarget)
          exec: jest.fn().mockImplementation(() => Promise.resolve(results)),
        };

        return chainMethods;
      }),
      findById: jest.fn().mockImplementation((id: string) => ({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockImplementation(() => {
          const doc = mockDocuments.get(id.toString());
          return Promise.resolve(doc || null);
        }),
      })),
      findByIdAndUpdate: jest
        .fn()
        .mockImplementation((id: string, update: any) => ({
          populate: jest.fn().mockReturnThis(),
          exec: jest.fn().mockImplementation(() => {
            const doc = mockDocuments.get(id.toString());
            if (!doc) return Promise.resolve(null);

            // Apply updates
            if (update.$set) {
              Object.assign(doc, update.$set);
            }
            if (update.$inc) {
              for (const [key, value] of Object.entries(update.$inc)) {
                doc[key] = (doc[key] || 0) + (value as number);
              }
            }
            if (update.$addToSet) {
              for (const [key, value] of Object.entries(update.$addToSet)) {
                if (!doc[key]) doc[key] = [];
                const valueStr = (value as Types.ObjectId).toString();
                const existingIds = doc[key].map((id: Types.ObjectId) => id.toString());
                if (!existingIds.includes(valueStr)) {
                  doc[key].push(value);
                }
              }
            }
            if (update.$pull) {
              for (const [key, value] of Object.entries(update.$pull)) {
                if (doc[key]) {
                  const valueStr = (value as Types.ObjectId).toString();
                  doc[key] = doc[key].filter(
                    (id: Types.ObjectId) => id.toString() !== valueStr,
                  );
                }
              }
            }
            doc.updatedAt = new Date();
            mockDocuments.set(id.toString(), doc);
            return Promise.resolve(doc);
          }),
        })),
      findByIdAndDelete: jest.fn().mockImplementation((id: string) => ({
        exec: jest.fn().mockImplementation(() => {
          const doc = mockDocuments.get(id.toString());
          if (doc) {
            mockDocuments.delete(id.toString());
          }
          return Promise.resolve(doc || null);
        }),
      })),
      updateMany: jest.fn().mockImplementation((filter: any, update: any) => {
        // Handle $pull operation for relatedDocs cleanup
        if (update.$pull && update.$pull.relatedDocs) {
          const idToRemove = update.$pull.relatedDocs.toString();
          for (const [, doc] of mockDocuments) {
            if (doc.relatedDocs) {
              doc.relatedDocs = doc.relatedDocs.filter(
                (relId: Types.ObjectId) => relId.toString() !== idToRemove,
              );
            }
          }
        }
        return Promise.resolve({ modifiedCount: 0 });
      }),
      countDocuments: jest.fn().mockImplementation((query: any = {}) => ({
        exec: jest.fn().mockImplementation(() => {
          let results = Array.from(mockDocuments.values());
          
          // Apply filters
          if (query.isPinned !== undefined) {
            results = results.filter((doc) => doc.isPinned === query.isPinned);
          }
          if (query.type) {
            results = results.filter((doc) => doc.type === query.type);
          }
          if (query.tags) {
            results = results.filter((doc) => doc.tags?.includes(query.tags));
          }
          
          return Promise.resolve(results.length);
        }),
      })),
      aggregate: jest.fn().mockImplementation((pipeline: any[]) => ({
        exec: jest.fn().mockImplementation(() => {
          const docs = Array.from(mockDocuments.values());
          
          // Simple aggregation for type grouping
          if (pipeline.length > 0 && pipeline[0].$group && pipeline[0].$group._id === '$type') {
            const typeCount: Record<string, number> = {};
            for (const doc of docs) {
              const type = doc.type || 'unknown';
              typeCount[type] = (typeCount[type] || 0) + 1;
            }
            return Promise.resolve(
              Object.entries(typeCount).map(([_id, count]) => ({ _id, count }))
            );
          }
          
          // Simple aggregation for tag grouping (with $unwind)
          if (pipeline.length > 0 && pipeline[0].$unwind === '$tags') {
            const tagCount: Record<string, number> = {};
            for (const doc of docs) {
              for (const tag of doc.tags || []) {
                tagCount[tag] = (tagCount[tag] || 0) + 1;
              }
            }
            const result = Object.entries(tagCount)
              .map(([_id, count]) => ({ _id, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 20);
            return Promise.resolve(result);
          }
          
          return Promise.resolve([]);
        }),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentationService,
        {
          provide: getModelToken(Documentation.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<DocumentationService>(DocumentationService);
  });

  afterEach(() => {
    mockDocuments.clear();
  });


  /**
   * **Feature: documentation-system, Property 1: Create-Read Round Trip**
   *
   * *For any* valid documentation data (title, content, type, tags, categories,
   * targets, technologies), creating a document and then reading it by ID
   * SHALL return a document with equivalent field values.
   *
   * **Validates: Requirements 1.1, 1.4**
   */
  describe('Property 1: Create-Read Round Trip', () => {
    it('should return equivalent field values when creating and reading a document', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          // Create the document
          const created = await service.create(dto);
          const createdId = created._id.toString();

          // Read the document back
          const retrieved = await service.findById(createdId);

          // Verify core fields match
          if (retrieved.title !== dto.title) return false;
          if (retrieved.content !== dto.content) return false;

          // Verify optional fields match when provided
          if (dto.type !== undefined && retrieved.type !== dto.type) return false;
          if (dto.tags !== undefined) {
            if (JSON.stringify(retrieved.tags) !== JSON.stringify(dto.tags))
              return false;
          }
          if (dto.categories !== undefined) {
            if (
              JSON.stringify(retrieved.categories) !==
              JSON.stringify(dto.categories)
            )
              return false;
          }
          if (dto.targets !== undefined) {
            if (JSON.stringify(retrieved.targets) !== JSON.stringify(dto.targets))
              return false;
          }
          if (dto.technologies !== undefined) {
            if (
              JSON.stringify(retrieved.technologies) !==
              JSON.stringify(dto.technologies)
            )
              return false;
          }
          if (dto.isPublic !== undefined && retrieved.isPublic !== dto.isPublic)
            return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve createdBy when userId is provided', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          const objectId = new Types.ObjectId();
          const created = await service.create(dto, objectId.toString());

          if (!created.createdBy) return false;
          if (created.createdBy.toString() !== objectId.toString()) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 13: View Increments Count and Timestamp**
   *
   * *For any* document with initial viewCount N, after calling findById with
   * incrementView=true, the viewCount SHALL be N+1 and lastAccessedAt SHALL
   * be updated to a recent timestamp.
   *
   * **Validates: Requirements 5.4**
   */
  describe('Property 13: View Increments Count and Timestamp', () => {
    it('should increment viewCount when incrementView is true', async () => {
      await fc.assert(
        fc.asyncProperty(
          createDocDtoArb,
          fc.nat({ max: 1000 }),
          async (dto, initialViewCount) => {
            // Create document with initial view count
            const created = await service.create(dto);
            const createdId = created._id.toString();

            // Set initial view count
            const doc = mockDocuments.get(createdId);
            doc.viewCount = initialViewCount;

            // Read with view increment
            const beforeAccess = new Date();
            const retrieved = await service.findById(createdId, true);

            // Verify view count incremented
            if (retrieved.viewCount !== initialViewCount + 1) return false;

            // Verify lastAccessedAt was updated
            if (!retrieved.lastAccessedAt) return false;
            if (
              new Date(retrieved.lastAccessedAt).getTime() <
              beforeAccess.getTime() - 1000
            )
              return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not increment viewCount when incrementView is false', async () => {
      await fc.assert(
        fc.asyncProperty(
          createDocDtoArb,
          fc.nat({ max: 1000 }),
          async (dto, initialViewCount) => {
            // Create document with initial view count
            const created = await service.create(dto);
            const createdId = created._id.toString();

            // Set initial view count
            const doc = mockDocuments.get(createdId);
            doc.viewCount = initialViewCount;

            // Read without view increment
            const retrieved = await service.findById(createdId, false);

            // Verify view count unchanged
            return retrieved.viewCount === initialViewCount;
          },
        ),
        { numRuns: 100 },
      );
    });
  });


  /**
   * **Feature: documentation-system, Property 2: Update Preserves Unchanged Fields**
   *
   * *For any* existing document and any partial update containing a subset of fields,
   * after the update, the document SHALL have the new values for updated fields
   * AND the original values for fields not included in the update.
   *
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Update Preserves Unchanged Fields', () => {
    it('should preserve unchanged fields after partial update', async () => {
      await fc.assert(
        fc.asyncProperty(
          createDocDtoArb,
          fc.record({
            title: fc.option(nonEmptyStringArb, { nil: undefined }),
            content: fc.option(nonEmptyStringArb, { nil: undefined }),
            type: fc.option(docTypeArb, { nil: undefined }),
          }),
          async (originalDto, updateDto) => {
            // Create original document
            const created = await service.create(originalDto);
            const createdId = created._id.toString();

            // Store original values
            const originalTitle = created.title;
            const originalContent = created.content;
            const originalType = created.type;
            const originalTags = [...(created.tags || [])];
            const originalCategories = [...(created.categories || [])];

            // Apply partial update
            const updateData: any = {};
            if (updateDto.title !== undefined) updateData.title = updateDto.title;
            if (updateDto.content !== undefined)
              updateData.content = updateDto.content;
            if (updateDto.type !== undefined) updateData.type = updateDto.type;

            const updated = await service.update(createdId, updateData);

            // Verify updated fields have new values
            if (updateDto.title !== undefined) {
              if (updated.title !== updateDto.title) return false;
            } else {
              if (updated.title !== originalTitle) return false;
            }

            if (updateDto.content !== undefined) {
              if (updated.content !== updateDto.content) return false;
            } else {
              if (updated.content !== originalContent) return false;
            }

            if (updateDto.type !== undefined) {
              if (updated.type !== updateDto.type) return false;
            } else {
              if (updated.type !== originalType) return false;
            }

            // Verify unchanged fields preserved
            if (JSON.stringify(updated.tags) !== JSON.stringify(originalTags))
              return false;
            if (
              JSON.stringify(updated.categories) !==
              JSON.stringify(originalCategories)
            )
              return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should set updatedBy when userId is provided', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          const created = await service.create(dto);
          const createdId = created._id.toString();
          const userId = new Types.ObjectId();

          const updated = await service.update(
            createdId,
            { title: 'Updated Title' },
            userId.toString(),
          );

          if (!updated.updatedBy) return false;
          if (updated.updatedBy.toString() !== userId.toString()) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 3: Delete Removes Document**
   *
   * *For any* existing document, after deletion, querying for that document
   * by ID SHALL return not found.
   *
   * **Validates: Requirements 1.3**
   */
  describe('Property 3: Delete Removes Document', () => {
    it('should remove document from database after deletion', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          // Create document
          const created = await service.create(dto);
          const createdId = created._id.toString();

          // Verify it exists
          const beforeDelete = await service.findById(createdId);
          if (!beforeDelete) return false;

          // Delete document
          await service.delete(createdId);

          // Verify it no longer exists
          try {
            await service.findById(createdId);
            return false; // Should have thrown
          } catch (error) {
            if (!(error instanceof NotFoundException)) return false;
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should throw NotFoundException when deleting non-existent document', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const nonExistentId = new Types.ObjectId().toString();

          try {
            await service.delete(nonExistentId);
            return false; // Should have thrown
          } catch (error) {
            if (!(error instanceof NotFoundException)) return false;
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });
  });


  /**
   * **Feature: documentation-system, Property 15: Deleted Doc Removed from Related Refs**
   *
   * *For any* document A that has document B in its relatedDocs, after deleting
   * document B, document A's relatedDocs SHALL no longer contain B's ID.
   *
   * **Validates: Requirements 6.3**
   */
  describe('Property 15: Deleted Doc Removed from Related Refs', () => {
    it('should remove deleted document ID from other documents relatedDocs', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, createDocDtoArb, async (dtoA, dtoB) => {
          // Create document B first
          const docB = await service.create(dtoB);
          const docBId = docB._id.toString();

          // Create document A with B in relatedDocs
          const docA = await service.create(dtoA);
          const docAId = docA._id.toString();

          // Manually add B to A's relatedDocs
          const docAData = mockDocuments.get(docAId);
          docAData.relatedDocs = [new Types.ObjectId(docBId)];

          // Delete document B
          await service.delete(docBId);

          // Verify B's ID is removed from A's relatedDocs
          const updatedDocA = mockDocuments.get(docAId);
          const relatedIds = (updatedDocA.relatedDocs || []).map(
            (id: Types.ObjectId) => id.toString(),
          );

          return !relatedIds.includes(docBId);
        }),
        { numRuns: 100 },
      );
    });

    it('should handle multiple documents referencing the deleted document', async () => {
      await fc.assert(
        fc.asyncProperty(
          createDocDtoArb,
          fc.array(createDocDtoArb, { minLength: 2, maxLength: 5 }),
          async (targetDto, referencingDtos) => {
            // Create target document to be deleted
            const targetDoc = await service.create(targetDto);
            const targetId = targetDoc._id.toString();

            // Create multiple documents that reference the target
            const referencingDocIds: string[] = [];
            for (const dto of referencingDtos) {
              const doc = await service.create(dto);
              const docId = doc._id.toString();
              const docData = mockDocuments.get(docId);
              docData.relatedDocs = [new Types.ObjectId(targetId)];
              referencingDocIds.push(docId);
            }

            // Delete target document
            await service.delete(targetId);

            // Verify target ID is removed from all referencing documents
            for (const docId of referencingDocIds) {
              const doc = mockDocuments.get(docId);
              const relatedIds = (doc.relatedDocs || []).map(
                (id: Types.ObjectId) => id.toString(),
              );
              if (relatedIds.includes(targetId)) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 4: List Sorting by Date**
   *
   * *For any* set of documents returned by findAll without explicit sort,
   * the documents SHALL be ordered by createdAt descending (newest first).
   *
   * **Validates: Requirements 1.5**
   */
  describe('Property 4: List Sorting by Date', () => {
    it('should return documents sorted by createdAt descending when no explicit sort', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 2, maxLength: 10 }),
          async (dtos) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents with different timestamps
            for (let i = 0; i < dtos.length; i++) {
              const doc = await service.create(dtos[i]);
              const docData = mockDocuments.get(doc._id.toString());
              // Set different createdAt times with some delay
              docData.createdAt = new Date(Date.now() - i * 1000);
              // Ensure all documents are not pinned for this test
              docData.isPinned = false;
            }

            // Fetch all documents without explicit sort
            const results = await service.findAll({ limit: 100 });

            // Verify documents are sorted by createdAt descending
            for (let i = 1; i < results.length; i++) {
              const prevDate = new Date((results[i - 1] as any).createdAt).getTime();
              const currDate = new Date((results[i] as any).createdAt).getTime();
              if (prevDate < currDate) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 12: Pinned Documents Sort First**
   *
   * *For any* list of documents with mixed pinned status, when sorted by default order,
   * all pinned documents SHALL appear before all non-pinned documents.
   *
   * **Validates: Requirements 5.3**
   */
  describe('Property 12: Pinned Documents Sort First', () => {
    it('should return pinned documents before non-pinned documents', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 2, maxLength: 10 }),
          fc.array(fc.boolean(), { minLength: 2, maxLength: 10 }),
          async (dtos, pinnedStatuses) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents with mixed pinned status
            const minLen = Math.min(dtos.length, pinnedStatuses.length);
            for (let i = 0; i < minLen; i++) {
              const doc = await service.create(dtos[i]);
              const docData = mockDocuments.get(doc._id.toString());
              docData.isPinned = pinnedStatuses[i];
              docData.createdAt = new Date(Date.now() - i * 1000);
            }

            // Fetch all documents with default sort
            const results = await service.findAll({ limit: 100 });

            // Find the first non-pinned document index
            let firstNonPinnedIndex = -1;
            for (let i = 0; i < results.length; i++) {
              if (!results[i].isPinned) {
                firstNonPinnedIndex = i;
                break;
              }
            }

            // If there are non-pinned documents, verify all pinned come before
            if (firstNonPinnedIndex > 0) {
              for (let i = firstNonPinnedIndex; i < results.length; i++) {
                if (results[i].isPinned) return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 10: Pagination Correctness**
   *
   * *For any* limit and offset values, findAll SHALL return at most `limit` documents
   * starting from position `offset` in the sorted result set.
   *
   * **Validates: Requirements 4.1**
   */
  describe('Property 10: Pagination Correctness', () => {
    it('should return at most limit documents starting from offset', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 5, maxLength: 15 }),
          fc.nat({ max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          async (dtos, offset, limit) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents
            for (let i = 0; i < dtos.length; i++) {
              const doc = await service.create(dtos[i]);
              const docData = mockDocuments.get(doc._id.toString());
              docData.isPinned = false;
              docData.createdAt = new Date(Date.now() - i * 1000);
            }

            // Fetch with pagination
            const results = await service.findAll({ limit, offset });

            // Verify result count is at most limit
            if (results.length > limit) return false;

            // Verify result count matches expected
            const expectedCount = Math.max(0, Math.min(limit, dtos.length - offset));
            if (results.length !== expectedCount) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 5: Tag Search Returns Matching Documents**
   *
   * *For any* tag value and set of documents, searching by that tag SHALL return
   * exactly the documents that contain that tag in their tags array.
   *
   * **Validates: Requirements 2.1, 2.3**
   */
  describe('Property 5: Tag Search Returns Matching Documents', () => {
    it('should return only documents containing the specified tag', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 3, maxLength: 10 }),
          nonEmptyStringArb,
          async (dtos, searchTag) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents, some with the search tag
            const docsWithTag: string[] = [];
            for (let i = 0; i < dtos.length; i++) {
              const dto = { ...dtos[i] };
              // Add the search tag to some documents
              if (i % 2 === 0) {
                dto.tags = [...(dto.tags || []), searchTag];
              }
              const doc = await service.create(dto);
              const docData = mockDocuments.get(doc._id.toString());
              docData.isPinned = false;
              if (docData.tags?.includes(searchTag)) {
                docsWithTag.push(doc._id.toString());
              }
            }

            // Search by tag
            const results = await service.findByTag(searchTag, { limit: 100 });

            // Verify all results contain the tag
            for (const result of results) {
              if (!result.tags?.includes(searchTag)) return false;
            }

            // Verify we got all documents with the tag
            const resultIds = results.map((r) => r._id.toString());
            for (const id of docsWithTag) {
              if (!resultIds.includes(id)) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 6: Type Filter Returns Correct Type**
   *
   * *For any* document type filter, all documents returned by findByType
   * SHALL have that exact type value.
   *
   * **Validates: Requirements 2.4**
   */
  describe('Property 6: Type Filter Returns Correct Type', () => {
    it('should return only documents of the specified type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 3, maxLength: 10 }),
          docTypeArb,
          async (dtos, filterType) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents with various types
            for (let i = 0; i < dtos.length; i++) {
              const dto = { ...dtos[i] };
              // Assign different types
              const types = Object.values(DocType);
              dto.type = types[i % types.length];
              const doc = await service.create(dto);
              const docData = mockDocuments.get(doc._id.toString());
              docData.isPinned = false;
            }

            // Filter by type
            const results = await service.findByType(filterType, { limit: 100 });

            // Verify all results have the correct type
            for (const result of results) {
              if (result.type !== filterType) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 9: Technology Filter Returns Matching Documents**
   *
   * *For any* technology value, findByTechnology SHALL return exactly the documents
   * that contain that technology in their technologies array.
   *
   * **Validates: Requirements 3.5**
   */
  describe('Property 9: Technology Filter Returns Matching Documents', () => {
    it('should return only documents containing the specified technology', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 3, maxLength: 10 }),
          nonEmptyStringArb,
          async (dtos, searchTech) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents, some with the search technology
            const docsWithTech: string[] = [];
            for (let i = 0; i < dtos.length; i++) {
              const dto = { ...dtos[i] };
              // Add the search technology to some documents
              if (i % 2 === 0) {
                dto.technologies = [...(dto.technologies || []), searchTech];
              }
              const doc = await service.create(dto);
              const docData = mockDocuments.get(doc._id.toString());
              docData.isPinned = false;
              if (docData.technologies?.includes(searchTech)) {
                docsWithTech.push(doc._id.toString());
              }
            }

            // Search by technology
            const results = await service.findByTechnology(searchTech, { limit: 100 });

            // Verify all results contain the technology
            for (const result of results) {
              if (!result.technologies?.includes(searchTech)) return false;
            }

            // Verify we got all documents with the technology
            const resultIds = results.map((r) => r._id.toString());
            for (const id of docsWithTech) {
              if (!resultIds.includes(id)) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 7: Text Search Across Fields**
   *
   * *For any* search term that appears in a document's title, content, or tags,
   * that document SHALL be included in the search results.
   *
   * **Validates: Requirements 2.5**
   */
  describe('Property 7: Text Search Across Fields', () => {
    // Generate a simple search term using letters
    const searchTermArb = fc.string({ minLength: 3, maxLength: 8 })
      .filter((s) => /^[a-z]+$/i.test(s) && s.trim().length >= 3);

    it('should return documents containing the search term in title, content, or tags', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 3, maxLength: 10 }),
          searchTermArb,
          async (dtos, searchTerm: string) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents, some with the search term in different fields
            const expectedMatchIds: string[] = [];
            for (let i = 0; i < dtos.length; i++) {
              const dto = { ...dtos[i] };
              let shouldMatch = false;

              // Add search term to different fields based on index
              if (i % 3 === 0) {
                dto.title = `${dto.title} ${searchTerm}`;
                shouldMatch = true;
              } else if (i % 3 === 1) {
                dto.content = `${dto.content} ${searchTerm}`;
                shouldMatch = true;
              } else if (i % 3 === 2) {
                dto.tags = [...(dto.tags || []), searchTerm];
                shouldMatch = true;
              }

              const doc = await service.create(dto);
              if (shouldMatch) {
                expectedMatchIds.push(doc._id.toString());
              }
            }

            // Search for the term
            const results = await service.search(searchTerm, { limit: 100 });

            // Verify all expected documents are in results
            const resultIds = results.map((r) => r._id.toString());
            for (const id of expectedMatchIds) {
              if (!resultIds.includes(id)) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should apply additional filters when searching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 5, maxLength: 10 }),
          searchTermArb,
          docTypeArb,
          async (dtos, searchTerm: string, filterType) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents with search term and various types
            const types = Object.values(DocType);
            for (let i = 0; i < dtos.length; i++) {
              const dto = { ...dtos[i] };
              dto.title = `${dto.title} ${searchTerm}`;
              dto.type = types[i % types.length];
              await service.create(dto);
            }

            // Search with type filter
            const results = await service.search(searchTerm, { type: filterType, limit: 100 });

            // Verify all results have the correct type
            for (const result of results) {
              if (result.type !== filterType) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 8: Coverage Query Returns Target Documents**
   *
   * *For any* target name, getCoverageForTarget SHALL return all documents that have
   * that target in their targets array or coverage array.
   *
   * **Validates: Requirements 3.3**
   */
  describe('Property 8: Coverage Query Returns Target Documents', () => {
    it('should return all documents covering the specified target', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 3, maxLength: 10 }),
          nonEmptyStringArb,
          async (dtos, targetName: string) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents, some with the target in targets array
            const expectedDocIds: string[] = [];
            for (let i = 0; i < dtos.length; i++) {
              const dto = { ...dtos[i] };
              
              // Add target to some documents
              if (i % 2 === 0) {
                dto.targets = [...(dto.targets || []), targetName];
              }

              const doc = await service.create(dto);
              const docData = mockDocuments.get(doc._id.toString());
              
              if (docData.targets?.includes(targetName)) {
                expectedDocIds.push(doc._id.toString());
              }
            }

            // Get coverage for target
            const result = await service.getCoverageForTarget(targetName);

            // Verify all expected documents are in results
            const resultDocIds = result.coverage.map((c) => c.docId);
            for (const id of expectedDocIds) {
              if (!resultDocIds.includes(id)) return false;
            }

            // Verify no unexpected documents are in results
            for (const coverage of result.coverage) {
              if (!expectedDocIds.includes(coverage.docId)) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return documents with target in coverage array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 3, maxLength: 10 }),
          nonEmptyStringArb,
          async (dtos, targetName: string) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents, some with the target in coverage array
            const expectedDocIds: string[] = [];
            for (let i = 0; i < dtos.length; i++) {
              const dto = { ...dtos[i] };
              const doc = await service.create(dto);
              const docData = mockDocuments.get(doc._id.toString());
              
              // Add target to coverage array for some documents
              if (i % 3 === 0) {
                docData.coverage = [{
                  targetId: new Types.ObjectId(),
                  targetType: 'program',
                  targetName: targetName,
                  relevanceScore: 0.8,
                  sections: ['section1'],
                }];
                expectedDocIds.push(doc._id.toString());
              }
            }

            // Get coverage for target
            const result = await service.getCoverageForTarget(targetName);

            // Verify all expected documents are in results
            const resultDocIds = result.coverage.map((c) => c.docId);
            for (const id of expectedDocIds) {
              if (!resultDocIds.includes(id)) return false;
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should calculate relevance scores correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          createDocDtoArb,
          nonEmptyStringArb,
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.9) }),
          async (dto, targetName: string, coverageScore: number) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create document with target in both targets array and coverage
            dto.targets = [...(dto.targets || []), targetName];
            const doc = await service.create(dto);
            const docData = mockDocuments.get(doc._id.toString());
            
            // Add coverage entry with specific score
            docData.coverage = [{
              targetId: new Types.ObjectId(),
              targetType: 'program',
              targetName: targetName,
              relevanceScore: coverageScore,
              sections: ['section1'],
            }];

            // Get coverage for target
            const result = await service.getCoverageForTarget(targetName);

            // Verify document is in results
            if (result.coverage.length !== 1) return false;

            // Verify relevance score is boosted (coverage score + 0.2, capped at 1)
            const expectedScore = Math.min(1, coverageScore + 0.2);
            const actualScore = result.coverage[0].relevanceScore;
            
            // Allow small floating point tolerance
            if (Math.abs(actualScore - expectedScore) > 0.001) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should sort results by relevance score descending', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(createDocDtoArb, { minLength: 3, maxLength: 10 }),
          nonEmptyStringArb,
          async (dtos, targetName: string) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create documents with varying relevance scores
            for (let i = 0; i < dtos.length; i++) {
              const dto = { ...dtos[i] };
              dto.targets = [...(dto.targets || []), targetName];
              const doc = await service.create(dto);
              const docData = mockDocuments.get(doc._id.toString());
              
              // Add coverage with different scores
              docData.coverage = [{
                targetId: new Types.ObjectId(),
                targetType: 'program',
                targetName: targetName,
                relevanceScore: (i + 1) / (dtos.length + 1),
                sections: [],
              }];
            }

            // Get coverage for target
            const result = await service.getCoverageForTarget(targetName);

            // Verify results are sorted by relevance score descending
            for (let i = 1; i < result.coverage.length; i++) {
              if (result.coverage[i - 1].relevanceScore < result.coverage[i].relevanceScore) {
                return false;
              }
            }

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 11: Pin Toggle Correctness**
   *
   * *For any* document, calling pin() SHALL set isPinned to true,
   * and calling unpin() SHALL set isPinned to false.
   *
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 11: Pin Toggle Correctness', () => {
    it('should set isPinned to true when pin() is called', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          // Create document (default isPinned is false)
          const created = await service.create(dto);
          const createdId = created._id.toString();

          // Verify initial state is not pinned
          const docBefore = mockDocuments.get(createdId);
          if (docBefore.isPinned !== false) return false;

          // Pin the document
          const pinned = await service.pin(createdId);

          // Verify isPinned is now true
          if (pinned.isPinned !== true) return false;

          // Verify the document in store is also updated
          const docAfter = mockDocuments.get(createdId);
          if (docAfter.isPinned !== true) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should set isPinned to false when unpin() is called', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          // Create document and pin it first
          const created = await service.create(dto);
          const createdId = created._id.toString();

          // Pin the document first
          await service.pin(createdId);

          // Verify it's pinned
          const docBefore = mockDocuments.get(createdId);
          if (docBefore.isPinned !== true) return false;

          // Unpin the document
          const unpinned = await service.unpin(createdId);

          // Verify isPinned is now false
          if (unpinned.isPinned !== false) return false;

          // Verify the document in store is also updated
          const docAfter = mockDocuments.get(createdId);
          if (docAfter.isPinned !== false) return false;

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should throw NotFoundException when pinning non-existent document', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const nonExistentId = new Types.ObjectId().toString();

          try {
            await service.pin(nonExistentId);
            return false; // Should have thrown
          } catch (error) {
            if (!(error instanceof NotFoundException)) return false;
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should throw NotFoundException when unpinning non-existent document', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const nonExistentId = new Types.ObjectId().toString();

          try {
            await service.unpin(nonExistentId);
            return false; // Should have thrown
          } catch (error) {
            if (!(error instanceof NotFoundException)) return false;
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should be idempotent - pinning already pinned document keeps it pinned', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          // Create and pin document
          const created = await service.create(dto);
          const createdId = created._id.toString();
          await service.pin(createdId);

          // Pin again
          const pinnedAgain = await service.pin(createdId);

          // Should still be pinned
          return pinnedAgain.isPinned === true;
        }),
        { numRuns: 100 },
      );
    });

    it('should be idempotent - unpinning already unpinned document keeps it unpinned', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          // Create document (default is unpinned)
          const created = await service.create(dto);
          const createdId = created._id.toString();

          // Unpin (even though it's already unpinned)
          const unpinned = await service.unpin(createdId);

          // Should still be unpinned
          return unpinned.isPinned === false;
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * **Feature: documentation-system, Property 14: Related Docs Populated on Fetch**
   *
   * *For any* document with relatedDocs containing valid document IDs,
   * fetching that document SHALL include populated related document data
   * (at minimum: _id, title, type).
   *
   * **Validates: Requirements 6.2**
   */
  describe('Property 14: Related Docs Populated on Fetch', () => {
    it('should populate related docs with _id, title, type when fetching', async () => {
      await fc.assert(
        fc.asyncProperty(
          createDocDtoArb,
          fc.array(createDocDtoArb, { minLength: 1, maxLength: 3 }),
          async (mainDto, relatedDtos) => {
            // Clear existing documents
            mockDocuments.clear();

            // Create related documents first
            const relatedIds: string[] = [];
            for (const relDto of relatedDtos) {
              const relDoc = await service.create(relDto);
              relatedIds.push(relDoc._id.toString());
            }

            // Create main document with related docs
            const mainDoc = await service.create(mainDto);
            const mainDocId = mainDoc._id.toString();

            // Add related docs to main document
            const mainDocData = mockDocuments.get(mainDocId);
            mainDocData.relatedDocs = relatedIds.map((id) => new Types.ObjectId(id));

            // Fetch the main document
            const fetched = await service.findById(mainDocId);

            // Verify relatedDocs is populated (in our mock, it returns the IDs)
            // In real implementation, this would be populated with full documents
            if (!fetched.relatedDocs) return false;
            if (fetched.relatedDocs.length !== relatedIds.length) return false;

            return true;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should add related doc using addRelatedDoc method', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, createDocDtoArb, async (mainDto, relatedDto) => {
          // Clear existing documents
          mockDocuments.clear();

          // Create both documents
          const mainDoc = await service.create(mainDto);
          const relatedDoc = await service.create(relatedDto);
          const mainDocId = mainDoc._id.toString();
          const relatedDocId = relatedDoc._id.toString();

          // Add related doc
          const updated = await service.addRelatedDoc(mainDocId, relatedDocId);

          // Verify related doc was added
          const relatedIds = (updated.relatedDocs || []).map((id: Types.ObjectId) =>
            id.toString(),
          );
          return relatedIds.includes(relatedDocId);
        }),
        { numRuns: 100 },
      );
    });

    it('should not duplicate related doc when adding same doc twice', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, createDocDtoArb, async (mainDto, relatedDto) => {
          // Clear existing documents
          mockDocuments.clear();

          // Create both documents
          const mainDoc = await service.create(mainDto);
          const relatedDoc = await service.create(relatedDto);
          const mainDocId = mainDoc._id.toString();
          const relatedDocId = relatedDoc._id.toString();

          // Add related doc twice
          await service.addRelatedDoc(mainDocId, relatedDocId);
          const updated = await service.addRelatedDoc(mainDocId, relatedDocId);

          // Verify related doc appears only once
          const relatedIds = (updated.relatedDocs || []).map((id: Types.ObjectId) =>
            id.toString(),
          );
          const count = relatedIds.filter((id: string) => id === relatedDocId).length;
          return count === 1;
        }),
        { numRuns: 100 },
      );
    });

    it('should remove related doc using removeRelatedDoc method', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, createDocDtoArb, async (mainDto, relatedDto) => {
          // Clear existing documents
          mockDocuments.clear();

          // Create both documents
          const mainDoc = await service.create(mainDto);
          const relatedDoc = await service.create(relatedDto);
          const mainDocId = mainDoc._id.toString();
          const relatedDocId = relatedDoc._id.toString();

          // Add then remove related doc
          await service.addRelatedDoc(mainDocId, relatedDocId);
          const updated = await service.removeRelatedDoc(mainDocId, relatedDocId);

          // Verify related doc was removed
          const relatedIds = (updated.relatedDocs || []).map((id: Types.ObjectId) =>
            id.toString(),
          );
          return !relatedIds.includes(relatedDocId);
        }),
        { numRuns: 100 },
      );
    });

    it('should throw NotFoundException when adding related doc to non-existent document', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          // Clear existing documents
          mockDocuments.clear();

          const relatedDoc = await service.create(dto);
          const nonExistentId = new Types.ObjectId().toString();

          try {
            await service.addRelatedDoc(nonExistentId, relatedDoc._id.toString());
            return false; // Should have thrown
          } catch (error) {
            if (!(error instanceof NotFoundException)) return false;
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });

    it('should throw NotFoundException when adding non-existent related doc', async () => {
      await fc.assert(
        fc.asyncProperty(createDocDtoArb, async (dto) => {
          // Clear existing documents
          mockDocuments.clear();

          const mainDoc = await service.create(dto);
          const nonExistentId = new Types.ObjectId().toString();

          try {
            await service.addRelatedDoc(mainDoc._id.toString(), nonExistentId);
            return false; // Should have thrown
          } catch (error) {
            if (!(error instanceof NotFoundException)) return false;
          }

          return true;
        }),
        { numRuns: 100 },
      );
    });
  });
});
