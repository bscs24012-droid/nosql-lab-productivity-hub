require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connect } = require('./db/connection');

(async () => {
  try {
    const db = await connect();

    // Clear existing data
    await db.collection('users').deleteMany({});
    await db.collection('projects').deleteMany({});
    await db.collection('tasks').deleteMany({});
    await db.collection('notes').deleteMany({});

    console.log('🗑️  Cleared existing collections');

    // Unique index on email so duplicate signups are rejected (query 1)
    await db.collection('users').createIndex({ email: 1 }, { unique: true });

    // ===================== USERS =====================
    // FIX: field must be "passwordHash" — auth route does bcrypt.compare(input, user.passwordHash)
    // Using "password" here causes "Illegal arguments: string, undefined" at login
    const passwordHash = await bcrypt.hash('password123', 10);

    const user1 = await db.collection('users').insertOne({
      email: 'user1@test.com',
      passwordHash,           // <-- was "password", must be "passwordHash"
      name: 'User One',
      createdAt: new Date()
    });

    const user2 = await db.collection('users').insertOne({
      email: 'user2@test.com',
      passwordHash,
      name: 'User Two',
      createdAt: new Date()
    });

    const user1Id = user1.insertedId;
    const user2Id = user2.insertedId;

    console.log('👤  Users inserted');

    // ===================== PROJECTS =====================
    const project1 = await db.collection('projects').insertOne({
      ownerId: user1Id,
      name: 'DB Lab',
      description: 'NoSQL lab work',
      archived: false,
      createdAt: new Date('2025-01-01')
    });

    const project2 = await db.collection('projects').insertOne({
      ownerId: user1Id,
      name: 'AI Assignment',
      description: 'Machine learning coursework',
      archived: false,
      createdAt: new Date('2025-01-05')
    });

    const project3 = await db.collection('projects').insertOne({
      ownerId: user2Id,
      name: 'Web Dev',
      description: 'Frontend and backend tasks',
      archived: false,
      createdAt: new Date('2025-01-03')
    });

    // Archived project — demonstrates archive filter in listUserProjects
    await db.collection('projects').insertOne({
      ownerId: user2Id,
      name: 'Old Project',
      description: 'Deprecated work',
      archived: true,
      archivedAt: new Date('2024-12-01'), // optional field — schema flexibility
      createdAt: new Date('2024-11-01')
    });

    console.log('📁  Projects inserted');

    // ===================== TASKS =====================
    await db.collection('tasks').insertMany([
      {
        ownerId: user1Id,
        projectId: project1.insertedId,
        title: 'Design schema',
        status: 'todo',
        priority: 1,
        tags: ['db', 'urgent'],
        subtasks: [
          { title: 'Users collection', done: false },
          { title: 'Projects collection', done: false }
        ],
        dueDate: new Date('2025-02-01'), // optional field — schema flexibility
        createdAt: new Date('2025-01-10')
      },
      {
        ownerId: user1Id,
        projectId: project1.insertedId,
        title: 'Write queries',
        status: 'in-progress',
        priority: 2,
        tags: ['backend'],
        subtasks: [
          { title: 'CRUD operations', done: true },
          { title: 'Aggregation pipelines', done: false }
        ],
        createdAt: new Date('2025-01-11')
      },
      {
        ownerId: user1Id,
        projectId: project2.insertedId,
        title: 'Train model',
        status: 'todo',
        priority: 3,
        tags: ['ml', 'urgent'],
        subtasks: [],
        dueDate: new Date('2025-02-15'),
        createdAt: new Date('2025-01-12')
      },
      {
        ownerId: user2Id,
        projectId: project3.insertedId,
        title: 'Build UI',
        status: 'done',
        priority: 1,
        tags: ['frontend'],
        subtasks: [
          { title: 'Navbar', done: true },
          { title: 'Footer', done: true }
        ],
        createdAt: new Date('2025-01-08')
      },
      {
        ownerId: user2Id,
        projectId: project3.insertedId,
        title: 'Fix bugs',
        status: 'todo',
        priority: 2,
        tags: ['debug', 'backend'],
        subtasks: [
          { title: 'Login issue', done: false }
        ],
        createdAt: new Date('2025-01-13')
      }
    ]);

    console.log('✅  Tasks inserted');

    // ===================== NOTES =====================
    // FIX: notes must have "title" and "body" fields to match the schema in MODELING.md
    // Using only "content" caused the frontend to crash rendering note.title / note.body
    await db.collection('notes').insertMany([
      {
        ownerId: user1Id,
        projectId: project1.insertedId,
        title: 'MongoDB revision',
        body: 'Revise MongoDB queries before the lab session',
        tags: ['study', 'db'],
        createdAt: new Date('2025-01-10')
      },
      {
        ownerId: user1Id,
        projectId: project2.insertedId,
        title: 'ML concepts',
        body: 'ML concepts: gradient descent, overfitting',
        tags: ['ml', 'exam'],
        pinned: true,           // optional field — schema flexibility, only on this note
        createdAt: new Date('2025-01-11')
      },
      {
        ownerId: user1Id,
        // No projectId — standalone note, demonstrates schema flexibility
        title: 'Side project idea',
        body: 'Random idea for side project',
        tags: ['idea'],
        createdAt: new Date('2025-01-12')
      },
      {
        ownerId: user2Id,
        projectId: project3.insertedId,
        title: 'Frontend improvements',
        body: 'Better responsive layout needed across all pages',
        tags: ['frontend', 'study'],
        createdAt: new Date('2025-01-09')
      },
      {
        ownerId: user2Id,
        // No projectId — standalone note
        title: 'Weekly goals',
        body: 'Personal notes about weekly goals',
        tags: ['personal'],
        createdAt: new Date('2025-01-14')
      }
    ]);

    console.log('📝  Notes inserted');
    console.log('');
    console.log('✅  Database seeded successfully');
    console.log('    Login: user1@test.com / user2@test.com  (password: password123)');

    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  }
})();
