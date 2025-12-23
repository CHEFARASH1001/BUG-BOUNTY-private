// MongoDB Initialization Script
// Create admin user first
db = db.getSiblingDB('admin');
db.createUser({
  user: 'admin',
  pwd: 'bugbounty2024',
  roles: [
    { role: 'userAdminAnyDatabase', db: 'admin' },
    { role: 'readWriteAnyDatabase', db: 'admin' },
    { role: 'dbAdminAnyDatabase', db: 'admin' }
  ]
});

// Switch to bugbounty database
db = db.getSiblingDB('bugbounty');

// Create collections with validators
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'createdAt'],
      properties: {
        email: { bsonType: 'string' },
        password: { bsonType: 'string' },
        name: { bsonType: 'string' },
        role: { enum: ['admin', 'user', 'viewer'] },
        apiKeys: { bsonType: 'object' },
        notifications: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('programs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'scope', 'createdAt'],
      properties: {
        name: { bsonType: 'string' },
        platform: { enum: ['hackerone', 'bugcrowd', 'intigriti', 'synack', 'custom', 'github', 'other'] },
        scope: { bsonType: 'array' },
        outOfScope: { bsonType: 'array' },
        status: { enum: ['active', 'paused', 'archived', 'open', 'closed'] },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('domains', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['domain', 'programId', 'createdAt'],
      properties: {
        domain: { bsonType: 'string' },
        programId: { bsonType: 'objectId' },
        status: { enum: ['pending', 'scanning', 'completed', 'failed'] },
        lastScan: { bsonType: 'date' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('subdomains', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['subdomain', 'domainId', 'createdAt'],
      properties: {
        subdomain: { bsonType: 'string' },
        domainId: { bsonType: 'objectId' },
        ip: { bsonType: 'array' },
        isAlive: { bsonType: 'bool' },
        httpStatus: { bsonType: 'int' },
        technologies: { bsonType: 'array' },
        ports: { bsonType: 'array' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('scans', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'targetId', 'status', 'createdAt'],
      properties: {
        type: { enum: ['full', 'subdomain', 'port', 'nuclei', 'technology', 'screenshot', 'custom'] },
        targetId: { bsonType: 'objectId' },
        targetType: { enum: ['domain', 'subdomain', 'program'] },
        status: { enum: ['queued', 'running', 'completed', 'failed', 'cancelled'] },
        progress: { bsonType: 'int' },
        results: { bsonType: 'object' },
        error: { bsonType: 'string' },
        startedAt: { bsonType: 'date' },
        completedAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('vulnerabilities', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'severity', 'target', 'createdAt'],
      properties: {
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        severity: { enum: ['critical', 'high', 'medium', 'low', 'info'] },
        type: { bsonType: 'string' },
        target: { bsonType: 'string' },
        targetId: { bsonType: 'objectId' },
        evidence: { bsonType: 'object' },
        status: { enum: ['new', 'confirmed', 'false_positive', 'reported', 'fixed', 'duplicate'] },
        cvss: { bsonType: 'double' },
        cwe: { bsonType: 'string' },
        template: { bsonType: 'string' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('endpoints', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['url', 'subdomainId', 'createdAt'],
      properties: {
        url: { bsonType: 'string' },
        subdomainId: { bsonType: 'objectId' },
        method: { bsonType: 'string' },
        statusCode: { bsonType: 'int' },
        contentType: { bsonType: 'string' },
        parameters: { bsonType: 'array' },
        source: { bsonType: 'string' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('screenshots', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['subdomainId', 'path', 'createdAt'],
      properties: {
        subdomainId: { bsonType: 'objectId' },
        url: { bsonType: 'string' },
        path: { bsonType: 'string' },
        thumbnail: { bsonType: 'string' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('notifications', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'message', 'createdAt'],
      properties: {
        type: { enum: ['vulnerability', 'scan_complete', 'new_subdomain', 'error', 'info'] },
        message: { bsonType: 'string' },
        data: { bsonType: 'object' },
        read: { bsonType: 'bool' },
        userId: { bsonType: 'objectId' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.programs.createIndex({ name: 1 });
db.programs.createIndex({ status: 1 });
db.domains.createIndex({ domain: 1 }, { unique: true });
db.domains.createIndex({ programId: 1 });
db.domains.createIndex({ status: 1 });
db.subdomains.createIndex({ subdomain: 1 }, { unique: true });
db.subdomains.createIndex({ domainId: 1 });
db.subdomains.createIndex({ isAlive: 1 });
db.scans.createIndex({ targetId: 1 });
db.scans.createIndex({ status: 1 });
db.scans.createIndex({ type: 1 });
db.scans.createIndex({ createdAt: -1 });
db.vulnerabilities.createIndex({ severity: 1 });
db.vulnerabilities.createIndex({ status: 1 });
db.vulnerabilities.createIndex({ targetId: 1 });
db.vulnerabilities.createIndex({ createdAt: -1 });
db.endpoints.createIndex({ subdomainId: 1 });
db.endpoints.createIndex({ url: 1 });
db.screenshots.createIndex({ subdomainId: 1 });
db.notifications.createIndex({ userId: 1 });
db.notifications.createIndex({ read: 1 });
db.notifications.createIndex({ createdAt: -1 });

print('Bug Bounty Database initialized successfully!');

