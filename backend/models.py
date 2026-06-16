from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Task(db.Model):
    __tablename__ = "task"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    subtasks = db.relationship("Subtask", backref="task", lazy=True, cascade="all, delete-orphan")
    completed = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )
    due_date = db.Column(
        db.Date,
        nullable=True
    )
    user_id = db.Column(db.Integer, nullable=False)

class Subtask(db.Model):
    __tablename__ = "subtask"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    completed = db.Column(db.Boolean, default=False, nullable=False)
    task_id = db.Column(db.Integer, db.ForeignKey("task.id"), nullable=False)

class User(db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)