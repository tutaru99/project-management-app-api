process.env.NODE_ENV = "test";
const chai = require("chai");
const chaiHttp = require("chai-http");
const server = require("../server");
const expect = require("chai").expect;
const should = chai.should();

chai.use(chaiHttp);

/* Test flow */
describe("/POST register a user", () => {
  it("it should register a test user", async () => {
    await chai
      .request(server)
      .post("/api/user/register")
      .send({
        username: "unitTesting",
        email: "unitTesting@test.testers",
        password: "12345678",
      })
      .then((res) => {
        res.should.have.status(200);
        res.body.data.should.be.a("string");
      });
  });
});

var userLogin;
var project;
var column;
var task;
var deletedProject;

describe("/Test endpoints according to the user flow", () => {
  it("it should login the registered test user", async () => {
    userLogin = await chai.request(server).post("/api/user/login").send({
      email: "unitTesting@test.testers",
      password: "12345678",
    });
    userLogin.should.have.status(200);
    userLogin.body.username.should.equal("unitTesting");
    userLogin.body.id.should.be.a("string");
    userLogin.body.token.should.be.a("string");
  });

  it("it should create a project", async () => {
    project = await chai
      .request(server)
      .post("/api/projects")
      .set("Authorization", `bearer ${userLogin.body.token}`)
      .send({
        title: "testProject",
        description: "just testin",
        user: userLogin.body.id,
      });
    project.should.have.status(200);
    project.body.title.should.equal("testProject");
    project.body.description.should.equal("just testin");
    project.body.owner[0].should.equal(userLogin.body.id);
    project.body.users.should.be.a("array");
    project.body.userRoles.should.be.a("array");
    project.body.columns.should.be.a("array");
    project.body.users.length.should.equal(0);
    project.body.userRoles.length.should.equal(0);
    project.body.columns.length.should.equal(0);
  });

  it("should create a new column", async () => {
    column = await chai
      .request(server)
      .put(`/api/projects/addcolumn/${project.body._id}`)
      .set("Authorization", `bearer ${userLogin.body.token}`)
      .send({
        col_name: "testColumn",
        userId: userLogin.body.id,
      });
    column.should.have.status(200);
    column.body.message.should.equal("Column was ADDED successfully!");
  });

  it("should create a new task", async () => {
    task = await chai
      .request(server)
      .put(`/api/projects/addtask/${column.body._id}`)
      .set("Authorization", `bearer ${userLogin.body.token}`)
      .send({
        task_name: "testTask",
        task_description: "testTaskDescription",
      });
    task.should.have.status(200);
    task.body.message.should.equal("Task was ADDED successfully!");
  });

  it("it should delete a project", async () => {
    deletedProject = await chai
      .request(server)
      .delete(`/api/projects/${project.body._id}?userId=${userLogin.body.id}`)
      .set({ Authorization: `bearer ${userLogin.body.token}` });
    deletedProject.should.have.status(200);
  });

  it("it should delete the registered test user", async () => {
    await chai
      .request(server)
      .post("/api/user/delete-account")
      .send({
        email: "unitTesting@test.testers",
      })
      .then((res) => {
        res.should.have.status(200);
        res.body.message.should.equal("User deleted");
      });
  });
});
