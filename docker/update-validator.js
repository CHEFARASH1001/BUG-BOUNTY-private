// MongoDB Validator Update Script
// Run this script to update the programs collection validator
// Usage: docker exec -i <mongo-container> mongosh -u admin -p bugbounty2024 --authenticationDatabase admin bugbounty < docker/update-validator.js

use('bugbounty');

// Update the programs collection validator
db.runCommand({
  collMod: 'programs',
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
  },
  validationLevel: 'moderate',
  validationAction: 'error'
});

print('Programs collection validator updated successfully!');

