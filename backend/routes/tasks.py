from flask import Blueprint, request, jsonify
from models import db, Task, Subtask
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from sqlalchemy import func

task_routes = Blueprint("tasks", __name__)

@task_routes.route("/", methods=["GET"])
@jwt_required()
def get_tasks():
    user_id = int(get_jwt_identity())

    try:
        tasks = (
            Task.query
            .filter_by(user_id=user_id)
            .order_by(Task.position.asc(), Task.id.asc())
            .all()
        )

        return jsonify([
            {
                "id": t.id,
                "title": t.title,
                "completed": t.completed,
                "position": t.position,
                "subtasks": [
                    {
                        "id": s.id,
                        "title": s.title,
                        "completed": s.completed
                    }
                    for s in t.subtasks
                ]
            }
            for t in tasks
        ])

    except Exception as e:
        print("GET TASK ERROR:", e)  # 👈 THIS IS KEY
        return jsonify({"error": "Server error"}), 500

@task_routes.route("/", methods=["POST"])
@jwt_required()
def add_task():
    data = request.json or {}

    title = data.get("title")
    user_id = int(get_jwt_identity())

    if not title:
        return jsonify({"error": "Title is required"}), 400

    try:
        due_date = None

        if data.get("due_date"):
            due_date = datetime.strptime(
                data["due_date"],
                "%Y-%m-%d"
            ).date()

        last_position = (
            db.session.query(func.max(Task.position))
            .filter(Task.user_id == user_id)
            .scalar()
        )

        new_task = Task(
            title=title,
            user_id=user_id,
            due_date=due_date,
            position=(last_position if last_position is not None else -1) + 1
        )

        db.session.add(new_task)
        db.session.commit()

        return jsonify({"message": "Task created"}), 201

    except Exception as e:
        print("ADD TASK ERROR:", str(e))
        return jsonify({"error": str(e)}), 500

@task_routes.route("/reorder", methods=["PUT"])
@jwt_required()
def reorder_tasks():
    data = request.get_json(silent=True) or {}
    ordered_ids = data.get("ordered_ids")
    user_id = int(get_jwt_identity())

    if not isinstance(ordered_ids, list) or any(
        not isinstance(task_id, int) for task_id in ordered_ids
    ):
        return jsonify({"error": "ordered_ids must be a list of integers"}), 400

    tasks = Task.query.filter_by(user_id=user_id).all()
    tasks_by_id = {task.id: task for task in tasks}

    if len(set(ordered_ids)) != len(ordered_ids):
        return jsonify({"error": "Task IDs must be unique"}), 400

    if set(ordered_ids) != set(tasks_by_id):
        return jsonify({"error": "Task list does not match your tasks"}), 400

    for position, task_id in enumerate(ordered_ids):
        tasks_by_id[task_id].position = position

    db.session.commit()

    return jsonify({"msg": "Task order updated"})

@task_routes.route("/<int:id>", methods=["PUT"])
@jwt_required()
def update_task(id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    task = Task.query.filter_by(id=id, user_id=user_id).first()

    if not task:
        return jsonify({"msg": "Not found"}), 404

    title = data.get("title")

    if not title:
        return jsonify({"error": "Title is required"}), 400

    task.title = data["title"]
    db.session.commit()

    return jsonify({"msg": "Updated"})

@task_routes.route("/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_task(id):
    user_id = int(get_jwt_identity())

    task = Task.query.filter_by(id=id, user_id=user_id).first()

    if not task:
        return jsonify({"msg": "Not found"}), 404

    db.session.delete(task)
    db.session.commit()

    return jsonify({"msg": "Deleted"})

@task_routes.route("/<int:id>/complete", methods=["PUT"])
@jwt_required()
def toggle_task(id):

    user_id = int(get_jwt_identity())

    task = Task.query.filter_by(
        id=id,
        user_id=user_id
    ).first()

    if not task:
        return jsonify({"error": "Not found"}), 404

    task.completed = not task.completed

    db.session.commit()

    return jsonify({"msg": "Updated"})

@task_routes.route("/subtasks/<int:id>", methods=["PUT"])
@jwt_required()
def update_subtask(id):
    data = request.get_json() or {}

    subtask = db.session.get(Subtask, id)

    if not subtask:
        return jsonify({"error": "Not found"}), 404

    task = Task.query.filter_by(
        id=subtask.task_id,
        user_id=int(get_jwt_identity())
    ).first()

    if not task:
        return jsonify({"error": "Unauthorized"}), 403

    subtask.completed = data.get("completed", False)

    db.session.commit()

    return jsonify({
        "msg": "Updated",
        "completed": subtask.completed
    })

@task_routes.route("/<int:id>/subtasks", methods=["DELETE"])
@jwt_required()
def clear_subtasks(id):
    user_id = int(get_jwt_identity())

    task = Task.query.filter_by(
        id=id,
        user_id=user_id
    ).first()

    if not task:
        return jsonify({"error": "Not found"}), 404

    Subtask.query.filter_by(task_id=id).delete()

    db.session.commit()

    return jsonify({"msg": "Subtasks cleared"})
