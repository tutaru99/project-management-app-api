const db = require("../models");
const Project = project = db.projects;
const ObjectId = require('mongodb').ObjectID;
const mongoose = require("mongoose");

/**
 * Middleware function that checks if user is added to the project.
 * @param {string} userId - The user who is either added to the project or is the project owner.
 * @param {string} projectId - The project ID.
 * @param {res} res - The response since if the user is not the project owner or added to the project the function will return 401 Unauthorized.
 * @param {boolean} requiresOwner - If it is true then the function will be checking if the user that we are checking is the owner or not. If it is false then the function will be checking if the user is a part of the project and is not the project owner. If left blank it will check if the user is in the project regardless of his role.
 * @returns {ProjectData} ProjectData object
 */
function checkIfUserIsInProject(userId, projectId, res, requiresOwner) {
    return new Promise(async (resolve, reject) => {
        const projectData = await project.findById(projectId)
            .catch(err => {
                console.log(err);
            })

        if (requiresOwner === true) {
            if (projectData.owner.includes(userId)) {
                return resolve(projectData)
            } else {
                res.status(401).send({
                    message: "Unauthorized"
                })
                return reject(new Error("Unauthorized"))
            }
        } else if (requiresOwner === false) {
            if (projectData.users.includes(userId)) {
                return resolve(projectData)
            } else {
                res.status(401).send({
                    message: "Unauthorized"
                })
                return reject(new Error("Unauthorized"))
            }
        } else {
            if (projectData.owner.includes(userId) || projectData.users.includes(userId)) {
                return resolve(projectData)
            } else {
                res.status(401).send({
                    message: "Unauthorized"
                })
                return reject(new Error("Unauthorized"))
            }
        }
    })
}

// Create and Save a new Project
exports.create = (req, res) => {
    // Validate request
    if (!req.body.title) {
        res.status(400).send({ message: "Content can not be empty!" });
        return;
    }

    // Create a Project
    const project = new Project({
        title: req.body.title,
        description: req.body.description,
        completed: req.body.completed,
        columns: req.body.columns,
        owner: req.body.user,
        published: req.body.published ? req.body.published : false
    });

    // Save Project in the database
    project
        .save(project)
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while creating the Project."
            });
        });
};


// Retrieve all Projects that are owned by a user.
exports.findAll = (req, res) => {
    project.find({
        'owner.0': ObjectId(req.user._id)
    }).populate({ path: 'users', select: ['username', 'email'] })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving Projects."
            });
        });
};

// Retrieve all Projects that a user is invited to.
exports.findAllInvited = (req, res) => {
    project.find({
        'users': ObjectId(req.user._id)
    }).populate({ path: 'users', select: ['username', 'email'] })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving Projects."
            });
        });

};

// Add a user to a project
exports.addUser = async (req, res) => {
    var error;

    const foundUser = await db.users
        .findOne({ email: req.body.userEmail })
        .catch((err) => {
            error = true
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving Projects.",
            });
        });

    if (!foundUser) {
        error = true
        return res.status(404).send({
            message: "We couldn't find this email. Are you sure it is registered on our platform?"
        })
    }

    await project.findById(req.body.projectId)
        .populate({ path: "users", select: ["username", "email"] })
        .then(data => {
            if (!data) {
                res.status(404).send({ message: "Error" });
            } else {
                if (data.owner[0] && data.owner[0].equals(foundUser._id)) {
                    error = true
                    return res.status(400).send({ message: 'This user is the owner of the project' })
                }
                for (user of data.users) {
                    if (user._id.equals(foundUser._id)) {
                        error = true
                        return res.status(400).send({ message: 'User is already added' })
                    }
                }
            }
        })
        .catch((err) => {
            error = true
            res.status(500).send({ message: "Error retrieving Project with id=" + id });
        });

    if (!error) {
        if (req.headers.role === "OWNER" || req.headers.role === "ADMIN") {

            await project.updateOne(
                { _id: ObjectId(req.body.projectId) },
                {
                    $push: {
                        users: ObjectId(foundUser._id),
                        userRoles: {
                            userId: ObjectId(foundUser._id),
                            role: "USER",
                        },
                    },
                }
            )
                .then((result) => {
                    if (result.ok) {
                        res.status(200).json(result.ok);
                    }
                })
                .catch((err) => {
                    res.status(500).send({
                        message: err.message || "Some error occurred while retrieving Projects.",
                    });
                });
        } else {
            res.status(401).json({
                message: "You dont have permissions to do this. Please contact the owner of the project.",
            });
        }
    }
};

//change user permissions for a project
exports.changeUserPermissionForProject = async (req, res) => {
    if (req.headers.role === 'OWNER' || req.headers.role === 'ADMIN') {
        project.updateOne(
            { '_id': mongoose.Types.ObjectId(req.body.projectId), 'userRoles.userId': mongoose.Types.ObjectId(req.body.userId) },
            { $set: { "userRoles.$.role": `${req.body.newPermission}` } }
        )
            .then(result => {
                if (result.n) {
                    res.status(200).json(result.n)
                }
            })
            .catch(err => {
                console.log(err)
            })
    } else {
        res.status(401).json({
            message: "You dont have permissions to do this. Please contact the owner of the project.",
        });
    }
}

//remove a user from a project
exports.removeUser = (req, res) => {
    checkIfUserIsInProject(req.body.userMakingRequestId, req.body.projectId, res).then(async () => {
        const foundUser = await db.users.findOne({ email: req.body.userEmail })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while retrieving Projects."
                });
            });
        project.updateOne(
            { '_id': ObjectId(req.body.projectId) },
            {
                $pull: {
                    'users': ObjectId(foundUser._id),
                    'userRoles': { 'userId': ObjectId(foundUser._id) }
                },
            }
        ).then(result => {
            if (result.ok) {
                res.status(200).json(result.ok)
            }
        })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while retrieving Projects."
                });
            });
    }).catch(err => {
        console.log(err);
    })
};

// Add a user to a task
exports.addUserToTask = async (req, res) => {
    const foundUser = await db.users
        .findOne({ email: req.body.userEmail })
        .catch((err) => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving Projects.",
            });
        });

    // Check if user is already assigned to task
    await project
        .findOne({ "columns.tasks._id": ObjectId(req.body.taskId) })
        .then(async (result) => {
            return new Promise(function (resolve, reject) {
                for (let column of result.columns) {
                    for (let task of column.tasks) {
                        if (task._id.equals(req.body.taskId)) {
                            if (task.asignee.length > 0) {
                                for (asignee of task.asignee) {
                                    if (asignee.equals(foundUser._id)) {
                                        reject();
                                        return res.status(500).send({
                                            message: "User is already assigned to task.",
                                        });
                                    } else {
                                        return resolve(true);
                                    }
                                }
                            } else {
                                return resolve(true);
                            }
                        }
                    }
                }
            });
        }).catch(err => {
            console.log(err)
        })

    await project
        .updateOne(
            { "columns.tasks._id": mongoose.Types.ObjectId(req.body.taskId) },
            {
                $push: {
                    "columns.$[].tasks.$[taskfield].asignee": mongoose.Types.ObjectId(foundUser._id),
                }
            },
            { arrayFilters: [{ "taskfield._id": mongoose.Types.ObjectId(req.body.taskId) }] }
        )
        .then((result) => {
            if (result.ok) {
                res.status(200).json(result.ok);
            }
        })
        .catch((err) => {
            console.log(err);
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving Projects.",
            });
        });
};


//remove a user from a task
exports.removeUserfromTask = async (req, res) => {

    const foundUser = await db.users.findOne({ email: req.body.userEmail })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving Projects."
            });
        });
    await project.updateOne(
        { 'columns.tasks._id': mongoose.Types.ObjectId(req.body.taskId) },
        {
            $pull: {
                "columns.$[].tasks.$[taskfield].asignee": mongoose.Types.ObjectId(foundUser._id)
            },
        },
        { arrayFilters: [{ "taskfield._id": mongoose.Types.ObjectId(req.body.taskId) }] }
    ).then(result => {
        if (result.ok) {
            res.status(200).json(result.ok)
        }
    })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving Projects."
            });
        });
};

// Find a single Project by an ID
exports.findOne = (req, res) => {
    const id = req.params.id;
    const userId = req.query.userId

    checkIfUserIsInProject(userId, id, res).then(() => {
        project.findById(id).populate({ path: 'users', select: ['username', 'email'] })
            .then(data => {
                if (!data)
                    res.status(404).send({ message: "Project not found with id " + id });
                else res.send(data);
            })
            .catch(err => {
                res.status(500).send({ message: "Error retrieving Project with id=" + id });
            });
    })
};

// Update a Project by the ID
exports.update = (req, res) => {
    const id = req.params.id;
    const userId = req.query.userId

    checkIfUserIsInProject(userId, id, res).then(() => {
        if (!req.body) {
            return res.status(400).send({
                message: "Data to update can not be empty!" + " - " + console.log(req.body),
            });
        }

        project.findByIdAndUpdate(id, req.body, { useFindAndModify: false })
            .then(data => {
                if (!data) {
                    res.status(404).send({
                        message: `Cannot update Project with id=${id}. Maybe Project was not found!`
                    });
                } else res.send({ message: "Project was updated successfully." + " With id: " + id + " consolelog: " + console.log(req.body) });
            })
            .catch(err => {
                console.log(err);
                res.status(500).send({
                    message: "Error updating Project with id=" + id
                });
            });
    })
        .catch(err => {
            console.log(err)
        })
};

// Delete a Project with the specified id in the request
exports.delete = (req, res) => {
    const id = req.params.id;
    const userId = req.query.userId

    checkIfUserIsInProject(userId, id, res, true)
        .then(() => {
            project.findByIdAndRemove(id)
                .then(data => {
                    if (!data) {
                        res.status(404).send({
                            message: `Cannot delete Project with id=${id}. Maybe Project was not found!`
                        });
                    } else {
                        res.send({
                            message: "Project was deleted successfully!"
                        });
                    }
                })
        })
        .catch(err => {
            console.error(err);
        })
}

//TASKS
// Delete a Single Task by ID
exports.deleteTask = (req, res) => {
    const id = req.params.id;

    project.update({ "columns.tasks._id": mongoose.Types.ObjectId(id) },
        {
            $pull:
                { "columns.$[].tasks": { "_id": mongoose.Types.ObjectId(id) } }
        },
        { "columns.tasks.$": true })
        .then(data => {
            if (!data) {
                res.status(404).send({
                    message: `Cannot update task with id=${id}.`
                });
            } else res.send({ message: "Task was deleted successfully!" });
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving tasks-."
            });
        });
};

// Add a new Task to column
exports.addTask = (req, res) => {
    const id = req.params.id;

    project.update({ "columns._id": mongoose.Types.ObjectId(id) },
        {
            $push: {
                "columns.$.tasks": {
                    "task_name": req.body.task_name,
                    "task_description": req.body.task_description
                }
            }
        })
        .then(data => {
            if (!data) {
                res.status(404).send({
                    message: `Cannot add task with id=${id}.`
                });
            } else res.send({ message: "Task was ADDED successfully!" });
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving tasks-."
            });
        });
};

// Update a TASK by the ID
exports.updateTask = (req, res) => {
    const id = req.params.id;

    project.update({ "columns.tasks._id": mongoose.Types.ObjectId(id) },
        {
            $set: {
                "columns.$[].tasks.$[taskfield].task_name": req.body.task_name,
                "columns.$[].tasks.$[taskfield].task_description": req.body.task_description,
                "columns.$[].tasks.$[taskfield].task_time": req.body.task_time,
                "columns.$[].tasks.$[taskfield].task_state": req.body.task_state,
                "columns.$[].tasks.$[taskfield].task_priority": req.body.task_priority,
            }
        },
        { arrayFilters: [{ "taskfield._id": mongoose.Types.ObjectId(id) }] }
    )
        .then(data => {
            if (!data) {
                res.status(404).send({
                    message: `Cannot update task with id=${id}.`
                });
            } else res.send({ message: "Task was Edited successfully!" + `${id}` });
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while Editing task-"
            });
        });
};
// Update a TASK by the ID QUICKEDIT
exports.updateTaskQuickEdit = (req, res) => {
    const id = req.params.id;

    project.update({ "columns.tasks._id": mongoose.Types.ObjectId(id) },
        {
            $set: {
                "columns.$[].tasks.$[taskfield].task_name": req.body.task_name,
                "columns.$[].tasks.$[taskfield].task_description": req.body.task_description,
            }
        },
        { arrayFilters: [{ "taskfield._id": mongoose.Types.ObjectId(id) }] }
    )
        .then(data => {
            if (!data) {
                res.status(404).send({
                    message: `Cannot update task with id=${id}.`
                });
            } else res.send({ message: "Task was Edited successfully!" + `${id}` });
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while Editing task-"
            });
        });
};

//Moving tasks to different columns
exports.moveTask = async (req, res) => {
    const id = req.params.id;
    const columnId = req.params.columnId;
    checkIfUserIsInProject(req.body.userId, req.body.projectId, res).then(async () => {
        var taskData;
        await project.find({ "columns.tasks._id": mongoose.Types.ObjectId(id) })
            .then(async result => {
                for await (column of result[0].columns) {
                    for await (task of column.tasks) {
                        if (task.id == mongoose.Types.ObjectId(id)) {
                            taskData = task
                        }
                    }
                }
            })

        await project.update({ "columns.tasks._id": mongoose.Types.ObjectId(id) },
            {
                $pull: { "columns.$[].tasks": { "_id": mongoose.Types.ObjectId(id) } },
            })
            .then(data => {
                if (!data) {
                    res.status(404).send({
                        message: `Cannot MOVE TASK with id= ${id}.`
                    });
                }
            })
            .catch(err => {
                res.status(500).send({
                    message: err.message || "Some error occurred while MOVING TASK"
                });
            });

        const newProjectData = await project.findById(req.body.projectId)
        for await (const column of newProjectData.columns) {
            if (column._id.equals(columnId)) {
                column.tasks = req.body.tasks
            }
        }
        newProjectData.save().then(() => {
            return res.status(200).send({ message: 'Task moved!' })
        }).catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while MOVING TASK"
            });
        })
    })
};

//Move task same Column
exports.moveTaskSameColumn = async (req, res) => {
    checkIfUserIsInProject(req.body.userId, req.body.projectId, res).then(async () => {
        const projectData = await project.findById(req.body.projectId)
        for await (const column of projectData.columns) {
            if (column._id.equals(req.params.columnId)) {
                column.tasks = req.body.tasks
            }
        }
        projectData.save().then(() => {
            return res.status(200).send({ message: 'Task moved!' })
        }).catch(err => {
            res.status(500).send({
                message: err.message || "Some error occurred while MOVING TASK"
            });
        })
    })
}


//COLUMNS
// Delete a Column with the specified ID
exports.deleteColumn = async (req, res) => {
    const id = req.params.id;
    const userId = req.query.user
    const projectId = req.query.project
    //Check if user is in project
    await checkIfUserIsInProject(userId, projectId, res)
        .then(() => {
            project.update({ "columns._id": mongoose.Types.ObjectId(id) },
                {
                    $pull:
                        { "columns": { "_id": mongoose.Types.ObjectId(id) } }
                })
                .then(data => {
                    if (!data) {
                        res.status(404).send({
                            message: `Cannot delete column with id=${id}.`
                        });
                    } else res.send({ message: "column was deleted successfully!" + `${id}` });
                })
                .catch(err => {
                    console.log(err);
                })
        }).catch((err) => {
            console.log(err)
        })
};

// Add a new Column to project
exports.addColumn = async (req, res) => {
    const projectId = req.params.id;
    const userId = req.body.userId
    //check if user is in the project
    await checkIfUserIsInProject(userId, projectId, res).then(() => {
        project.findByIdAndUpdate({ "_id": mongoose.Types.ObjectId(projectId) },
            {
                $push: {
                    "columns": {
                        "col_name": req.body.col_name
                    }
                }
            },
            {
                new: true
            })
            .then(data => {
                if (!data) {
                    res.status(404).send({
                        message: `Cannot add Column with id=${projectId}.`
                    });
                } else res.send({
                    message: "Column was ADDED successfully!",
                    _id: data._id
                });
            })
            .catch(err => {
                res.status(500).send({
                    message:
                        err.message || "Some error occurred while retrieving Column-."
                });
            });
    })
};

//Edit Column name
exports.editColumn = (req, res) => {
    const id = req.params.id;

    project.update({ "columns._id": mongoose.Types.ObjectId(id) },
        {
            $set: {
                "columns.$.col_name": req.body.col_name,
            }
        },
    )
        .then(data => {
            if (!data) {
                res.status(404).send({
                    message: `Cannot update column name with id=${id}.`
                });
            } else res.send({ message: "Column name was updated successfully! " + `${id}` });
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while updating column name"
            });
        });
};


//PROJECT
// Delete all Projects at once from the database.
exports.deleteAll = (req, res) => {

    project.deleteMany({})
        .then(data => {
            res.send({
                message: `${data.deletedCount} Projects were deleted successfully!`
            });
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while removing all projects."
            });
        });
};

// Find Projects by set Condition
/* exports.findAllCompleted = (req, res) => {

    project.find({ completed: true })
        .then(data => {
            res.send(data);
        })
        .catch(err => {
            res.status(500).send({
                message:
                    err.message || "Some error occurred while retrieving projects."
            });
        });
}; */