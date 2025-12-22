import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  Documentation,
  DocumentationDocument,
  DocType,
} from '../../schemas/documentation.schema';
import {
  CreateDocumentationDto,
  UpdateDocumentationDto,
  DocumentationFilterDto,
} from './dto/documentation.dto';

export interface DocumentationFilter {
  type?: DocType;
  tag?: string;
  category?: string;
  target?: string;
  technology?: string;
  vulnerabilityType?: string;
  createdBy?: string;
  isPinned?: boolean;
  isPublic?: boolean;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface CoverageResult {
  target: string;
  coverage: {
    docId: string;
    title: string;
    type: DocType;
    relevanceScore: number;
    sections: string[];
    tags: string[];
  }[];
}

@Injectable()
export class DocumentationService {
  constructor(
    @InjectModel(Documentation.name)
    private documentationModel: Model<DocumentationDocument>,
  ) {}

  /**
   * Create a new documentation entry
   * @param data - CreateDocumentationDto with title, content, and optional fields
   * @param userId - Optional user ID to set as createdBy
   * @returns The created documentation document
   * Requirements: 1.1
   */
  async create(
    data: CreateDocumentationDto,
    userId?: string,
  ): Promise<DocumentationDocument> {
    const docData: any = { ...data };

    if (userId) {
      docData.createdBy = new Types.ObjectId(userId);
    }

    // Convert relatedDocs string array to ObjectId array if provided
    if (data.relatedDocs && data.relatedDocs.length > 0) {
      docData.relatedDocs = data.relatedDocs.map(
        (id) => new Types.ObjectId(id),
      );
    }

    const doc = await this.documentationModel.create(docData);
    return doc;
  }

  /**
   * Find a documentation entry by ID with optional view increment
   * @param id - Document ID
   * @param incrementView - If true, increment viewCount and update lastAccessedAt
   * @returns The documentation document with populated relatedDocs
   * Requirements: 1.4, 5.4, 6.2
   */
  async findById(
    id: string,
    incrementView = false,
  ): Promise<DocumentationDocument> {
    let doc: DocumentationDocument | null;

    if (incrementView) {
      doc = await this.documentationModel
        .findByIdAndUpdate(
          id,
          {
            $inc: { viewCount: 1 },
            $set: { lastAccessedAt: new Date() },
          },
          { new: true },
        )
        .populate('relatedDocs', '_id title type')
        .exec();
    } else {
      doc = await this.documentationModel
        .findById(id)
        .populate('relatedDocs', '_id title type')
        .exec();
    }

    if (!doc) {
      throw new NotFoundException(`Documentation with ID ${id} not found`);
    }

    return doc;
  }

  /**
   * Update a documentation entry
   * @param id - Document ID
   * @param data - UpdateDocumentationDto with fields to update
   * @param userId - Optional user ID to set as updatedBy
   * @returns The updated documentation document
   * Requirements: 1.2
   */
  async update(
    id: string,
    data: UpdateDocumentationDto,
    userId?: string,
  ): Promise<DocumentationDocument> {
    const existingDoc = await this.documentationModel.findById(id).exec();
    if (!existingDoc) {
      throw new NotFoundException(`Documentation with ID ${id} not found`);
    }

    const updateData: any = { ...data };

    if (userId) {
      updateData.updatedBy = new Types.ObjectId(userId);
    }

    // Convert relatedDocs string array to ObjectId array if provided
    if (data.relatedDocs && data.relatedDocs.length > 0) {
      updateData.relatedDocs = data.relatedDocs.map(
        (docId) => new Types.ObjectId(docId),
      );
    }

    const doc = await this.documentationModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('relatedDocs', '_id title type')
      .exec();

    return doc!;
  }

  /**
   * Delete a documentation entry and clean up related references
   * @param id - Document ID
   * Requirements: 1.3, 6.3
   */
  async delete(id: string): Promise<void> {
    const doc = await this.documentationModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException(`Documentation with ID ${id} not found`);
    }

    // Remove this document's ID from all other documents' relatedDocs arrays
    await this.documentationModel.updateMany(
      { relatedDocs: new Types.ObjectId(id) },
      { $pull: { relatedDocs: new Types.ObjectId(id) } },
    );

    await this.documentationModel.findByIdAndDelete(id).exec();
  }

  /**
   * Build a MongoDB query from DocumentationFilter
   * @param filter - DocumentationFilter with optional filter criteria
   * @returns MongoDB FilterQuery
   */
  private buildQuery(
    filter: DocumentationFilter,
  ): FilterQuery<DocumentationDocument> {
    const query: FilterQuery<DocumentationDocument> = {};

    if (filter.type) {
      query.type = filter.type;
    }

    if (filter.tag) {
      query.tags = filter.tag;
    }

    if (filter.category) {
      query.categories = filter.category;
    }

    if (filter.target) {
      query.targets = filter.target;
    }

    if (filter.technology) {
      query.technologies = filter.technology;
    }

    if (filter.vulnerabilityType) {
      query.vulnerabilityTypes = filter.vulnerabilityType;
    }

    if (filter.createdBy) {
      query.createdBy = new Types.ObjectId(filter.createdBy);
    }

    if (filter.isPinned !== undefined) {
      query.isPinned = filter.isPinned;
    }

    if (filter.isPublic !== undefined) {
      query.isPublic = filter.isPublic;
    }

    return query;
  }

  /**
   * Find all documentation entries with filtering and pagination
   * @param filter - DocumentationFilter with optional filter criteria
   * @returns Array of documentation documents sorted by isPinned desc, then createdAt desc
   * Requirements: 1.5, 5.3
   */
  async findAll(filter: DocumentationFilter = {}): Promise<DocumentationDocument[]> {
    const query = this.buildQuery(filter);
    const limit = filter.limit ?? 20;
    const offset = filter.offset ?? 0;

    // Default sort: isPinned desc, then createdAt desc
    let sortOption: Record<string, 1 | -1> = { isPinned: -1, createdAt: -1 };

    // Parse custom sort if provided (e.g., "-createdAt" or "title")
    if (filter.sort) {
      const sortField = filter.sort.startsWith('-')
        ? filter.sort.substring(1)
        : filter.sort;
      const sortDirection = filter.sort.startsWith('-') ? -1 : 1;
      sortOption = { [sortField]: sortDirection as 1 | -1 };
    }

    const docs = await this.documentationModel
      .find(query)
      .sort(sortOption)
      .skip(offset)
      .limit(limit)
      .populate('relatedDocs', '_id title type')
      .exec();

    return docs;
  }

  /**
   * Find documentation entries by tag
   * @param tag - Tag to search for
   * @param filter - Additional filter criteria
   * @returns Array of documentation documents containing the specified tag
   * Requirements: 2.1, 2.3
   */
  async findByTag(
    tag: string,
    filter: DocumentationFilter = {},
  ): Promise<DocumentationDocument[]> {
    return this.findAll({ ...filter, tag });
  }

  /**
   * Find documentation entries by type
   * @param type - DocType to filter by
   * @param filter - Additional filter criteria
   * @returns Array of documentation documents of the specified type
   * Requirements: 2.4
   */
  async findByType(
    type: DocType,
    filter: DocumentationFilter = {},
  ): Promise<DocumentationDocument[]> {
    return this.findAll({ ...filter, type });
  }

  /**
   * Find documentation entries by technology
   * @param technology - Technology to search for
   * @param filter - Additional filter criteria
   * @returns Array of documentation documents containing the specified technology
   * Requirements: 3.5
   */
  async findByTechnology(
    technology: string,
    filter: DocumentationFilter = {},
  ): Promise<DocumentationDocument[]> {
    return this.findAll({ ...filter, technology });
  }

  /**
   * Search documentation using MongoDB text index
   * @param query - Search query string
   * @param filter - Additional filter criteria
   * @returns Array of documentation documents matching the search query, sorted by text score relevance
   * Requirements: 2.5
   */
  async search(
    query: string,
    filter: DocumentationFilter = {},
  ): Promise<DocumentationDocument[]> {
    const filterQuery = this.buildQuery(filter);
    const limit = filter.limit ?? 20;
    const offset = filter.offset ?? 0;

    // Use MongoDB $text search on title, content, tags (text index defined in schema)
    const searchQuery: FilterQuery<DocumentationDocument> = {
      ...filterQuery,
      $text: { $search: query },
    };

    const docs = await this.documentationModel
      .find(searchQuery, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .skip(offset)
      .limit(limit)
      .populate('relatedDocs', '_id title type')
      .exec();

    return docs;
  }

  /**
   * Get coverage information for a specific target
   * @param target - Target name to get coverage for
   * @returns CoverageResult with all documents covering the target and their relevance scores
   * Requirements: 3.3
   */
  async getCoverageForTarget(target: string): Promise<CoverageResult> {
    // Find documents where targets array contains target OR coverage array has matching targetName
    const docs = await this.documentationModel
      .find({
        $or: [
          { targets: target },
          { 'coverage.targetName': target },
        ],
      })
      .exec();

    const coverage = docs.map((doc) => {
      // Calculate relevance score based on match type
      let relevanceScore = 0.5; // Default score for targets array match
      let sections: string[] = [];

      // Check if there's a specific coverage entry for this target
      const coverageEntry = doc.coverage?.find(
        (c) => c.targetName === target,
      );

      if (coverageEntry) {
        // Use the relevance score from coverage entry if available
        relevanceScore = coverageEntry.relevanceScore ?? 0.8;
        sections = coverageEntry.sections ?? [];
      }

      // Boost score if target is in both targets array and coverage
      if (doc.targets?.includes(target) && coverageEntry) {
        relevanceScore = Math.min(1, relevanceScore + 0.2);
      }

      return {
        docId: doc._id.toString(),
        title: doc.title,
        type: doc.type,
        relevanceScore,
        sections,
        tags: doc.tags || [],
      };
    });

    // Sort by relevance score descending
    coverage.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      target,
      coverage,
    };
  }

  /**
   * Pin a documentation entry
   * @param id - Document ID
   * @returns The updated documentation document with isPinned set to true
   * Requirements: 5.1
   */
  async pin(id: string): Promise<DocumentationDocument> {
    const doc = await this.documentationModel
      .findByIdAndUpdate(id, { $set: { isPinned: true } }, { new: true })
      .populate('relatedDocs', '_id title type')
      .exec();

    if (!doc) {
      throw new NotFoundException(`Documentation with ID ${id} not found`);
    }

    return doc;
  }

  /**
   * Unpin a documentation entry
   * @param id - Document ID
   * @returns The updated documentation document with isPinned set to false
   * Requirements: 5.2
   */
  async unpin(id: string): Promise<DocumentationDocument> {
    const doc = await this.documentationModel
      .findByIdAndUpdate(id, { $set: { isPinned: false } }, { new: true })
      .populate('relatedDocs', '_id title type')
      .exec();

    if (!doc) {
      throw new NotFoundException(`Documentation with ID ${id} not found`);
    }

    return doc;
  }

  /**
   * Add a related document to a documentation entry
   * @param id - Document ID
   * @param relatedId - Related document ID to add
   * @returns The updated documentation document
   * Requirements: 6.1
   */
  async addRelatedDoc(id: string, relatedId: string): Promise<DocumentationDocument> {
    // Validate both documents exist
    const doc = await this.documentationModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException(`Documentation with ID ${id} not found`);
    }

    const relatedDoc = await this.documentationModel.findById(relatedId).exec();
    if (!relatedDoc) {
      throw new NotFoundException(`Related documentation with ID ${relatedId} not found`);
    }

    // Add relatedId to relatedDocs array if not already present
    const updatedDoc = await this.documentationModel
      .findByIdAndUpdate(
        id,
        { $addToSet: { relatedDocs: new Types.ObjectId(relatedId) } },
        { new: true },
      )
      .populate('relatedDocs', '_id title type')
      .exec();

    return updatedDoc!;
  }

  /**
   * Remove a related document from a documentation entry
   * @param id - Document ID
   * @param relatedId - Related document ID to remove
   * @returns The updated documentation document
   * Requirements: 6.1
   */
  async removeRelatedDoc(id: string, relatedId: string): Promise<DocumentationDocument> {
    const doc = await this.documentationModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException(`Documentation with ID ${id} not found`);
    }

    // Remove relatedId from relatedDocs array
    const updatedDoc = await this.documentationModel
      .findByIdAndUpdate(
        id,
        { $pull: { relatedDocs: new Types.ObjectId(relatedId) } },
        { new: true },
      )
      .populate('relatedDocs', '_id title type')
      .exec();

    return updatedDoc!;
  }

  /**
   * Count documentation entries with optional filter
   * @param filter - Optional filter criteria
   * @returns The count of matching documents
   * Requirements: 4.1
   */
  async count(filter: DocumentationFilter = {}): Promise<number> {
    const query = this.buildQuery(filter);
    return this.documentationModel.countDocuments(query).exec();
  }

  /**
   * Get aggregate statistics for documentation
   * @returns DocumentationStats with total count, counts by type, and counts by tag
   * Requirements: 4.1
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byTag: Record<string, number>;
    pinnedCount: number;
  }> {
    const total = await this.documentationModel.countDocuments().exec();
    const pinnedCount = await this.documentationModel.countDocuments({ isPinned: true }).exec();

    // Aggregate by type
    const typeAggregation = await this.documentationModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).exec();

    const byType: Record<string, number> = {};
    for (const item of typeAggregation) {
      byType[item._id || 'unknown'] = item.count;
    }

    // Aggregate by tag
    const tagAggregation = await this.documentationModel.aggregate([
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }, // Limit to top 20 tags
    ]).exec();

    const byTag: Record<string, number> = {};
    for (const item of tagAggregation) {
      byTag[item._id] = item.count;
    }

    return {
      total,
      byType,
      byTag,
      pinnedCount,
    };
  }
}
