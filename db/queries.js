const { ObjectId } = require('mongodb');

// Query 1: signupUser
// Technique: insertOne
// Duplicate emails are rejected automatically by the unique index on users.email
// (created in seed.js) — the server's error handler catches code 11000
async function signupUser(db, userData) {
  return db.collection('users').insertOne({
    name: userData.name,
    email: userData.email,
    passwordHash: userData.passwordHash,
    createdAt: new Date()
  });
}

// Query 2: loginFindUser
// Technique: findOne
async function loginFindUser(db, email) {
  return db.collection('users').findOne({ email });
}

// Query 3: listUserProjects
// Technique: find().sort()
async function listUserProjects(db, ownerId) {
  return db.collection('projects')
    .find({ ownerId: new ObjectId(ownerId), archived: false })
    .sort({ createdAt: -1 })
    .toArray();
}

// Query 4: createProject
// Technique: insertOne
async function createProject(db, projectData) {
  return db.collection('projects').insertOne({
    ownerId: new ObjectId(projectData.ownerId),
    name: projectData.name,
    description: projectData.description || '',
    archived: false,
    createdAt: new Date()
  });
}

// Query 5: archiveProject
// Technique: updateOne + $set
async function archiveProject(db, projectId) {
  return db.collection('projects').updateOne(
    { _id: new ObjectId(projectId) },
    { $set: { archived: true } }
  );
}

// Query 6: listProjectTasks
// Technique: find with multi-field filter + sort
async function listProjectTasks(db, projectId, status) {
  const filter = { projectId: new ObjectId(projectId) };
  if (status) filter.status = status;
  return db.collection('tasks')
    .find(filter)
    .sort({ priority: -1, createdAt: -1 })
    .toArray();
}

// Query 7: createTask
// Technique: insertOne with embedded subtasks and tags
async function createTask(db, taskData) {
  return db.collection('tasks').insertOne({
    ownerId: new ObjectId(taskData.ownerId),
    projectId: new ObjectId(taskData.projectId),
    title: taskData.title,
    status: 'todo',
    priority: taskData.priority || 1,
    tags: taskData.tags || [],
    subtasks: taskData.subtasks || [],
    createdAt: new Date()
  });
}

// Query 8: updateTaskStatus
// Technique: updateOne + $set
async function updateTaskStatus(db, taskId, newStatus) {
  return db.collection('tasks').updateOne(
    { _id: new ObjectId(taskId) },
    { $set: { status: newStatus } }
  );
}

// Query 9: addTaskTag
// Technique: updateOne + $addToSet (no duplicates)
async function addTaskTag(db, taskId, tag) {
  return db.collection('tasks').updateOne(
    { _id: new ObjectId(taskId) },
    { $addToSet: { tags: tag } }
  );
}

// Query 10: removeTaskTag
// Technique: updateOne + $pull
async function removeTaskTag(db, taskId, tag) {
  return db.collection('tasks').updateOne(
    { _id: new ObjectId(taskId) },
    { $pull: { tags: tag } }
  );
}

// Query 11: toggleSubtask
// Technique: positional $ operator — matches the first subtask whose title equals
// subtaskTitle, then sets its done flag without touching other subtasks
async function toggleSubtask(db, taskId, subtaskTitle, newDone) {
  return db.collection('tasks').updateOne(
    { _id: new ObjectId(taskId), 'subtasks.title': subtaskTitle },
    { $set: { 'subtasks.$.done': newDone } }
  );
}

// Query 12: deleteTask
// Technique: deleteOne
async function deleteTask(db, taskId) {
  return db.collection('tasks').deleteOne(
    { _id: new ObjectId(taskId) }
  );
}

// Query 13: searchNotes
// Technique: $in on array field + optional projectId filter
async function searchNotes(db, ownerId, tags, projectId) {
  const filter = {
    ownerId: new ObjectId(ownerId),
    tags: { $in: tags }
  };
  if (projectId) filter.projectId = new ObjectId(projectId);
  return db.collection('notes')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
}

// Query 14: projectTaskSummary
// Technique: $match → $group → $lookup → $project → $sort
async function projectTaskSummary(db, ownerId) {
  return db.collection('tasks').aggregate([
    // Only this user's tasks
    { $match: { ownerId: new ObjectId(ownerId) } },
    // Count each status bucket per project
    {
      $group: {
        _id: '$projectId',
        todo:       { $sum: { $cond: [{ $eq: ['$status', 'todo'] },        1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
        done:       { $sum: { $cond: [{ $eq: ['$status', 'done'] },        1, 0] } },
        total:      { $sum: 1 }
      }
    },
    // Join projects collection to get the project name
    {
      $lookup: {
        from: 'projects',
        localField: '_id',
        foreignField: '_id',
        as: 'project'
      }
    },
    // $lookup returns an array — unwind to a single object
    { $unwind: '$project' },
    // Shape the output
    {
      $project: {
        _id: 1,
        projectName: '$project.name',
        todo: 1,
        inProgress: 1,
        done: 1,
        total: 1
      }
    },
    // Sort alphabetically by project name for consistent display
    { $sort: { projectName: 1 } }
  ]).toArray();
}

// Query 15: recentActivityFeed
// Technique: $match → $sort → $limit → $lookup → $unwind → $project
async function recentActivityFeed(db, ownerId) {
  return db.collection('tasks').aggregate([
    // Only this user's tasks
    { $match: { ownerId: new ObjectId(ownerId) } },
    // Newest first
    { $sort: { createdAt: -1 } },
    // Cap at 10
    { $limit: 10 },
    // Join projects to attach the project name
    {
      $lookup: {
        from: 'projects',
        localField: 'projectId',
        foreignField: '_id',
        as: 'project'
      }
    },
    { $unwind: '$project' },
    // Return only what the frontend needs
    {
      $project: {
        _id: 1,
        title: 1,
        status: 1,
        priority: 1,
        createdAt: 1,
        projectId: 1,
        projectName: '$project.name'
      }
    }
  ]).toArray();
}

// =============================================================================
//  EXPORTS — do not edit
// =============================================================================
module.exports = {
  signupUser,
  loginFindUser,
  listUserProjects,
  createProject,
  archiveProject,
  listProjectTasks,
  createTask,
  updateTaskStatus,
  addTaskTag,
  removeTaskTag,
  toggleSubtask,
  deleteTask,
  searchNotes,
  projectTaskSummary,
  recentActivityFeed
};
