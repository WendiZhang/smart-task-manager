from flask import Blueprint, request, jsonify
import os
from openai import OpenAI
from models import db, Task, Subtask
from flask_jwt_extended import jwt_required, get_jwt_identity

ai_routes = Blueprint("ai", __name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@ai_routes.route("/breakdown", methods=["POST"])
@jwt_required()
def breakdown_task():

    try:

        data = request.get_json(silent=True) or {}
        task = data.get("task")
        task_id = data.get("task_id")

        if not task or not task_id:
            return jsonify({"error": "Missing task"}), 400

        user_id = int(get_jwt_identity())

        task_record = Task.query.filter_by(
            id=task_id,
            user_id=user_id
        ).first()

        if not task_record:
            return jsonify({"error": "Task not found"}), 404

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Break tasks into short actionable subtasks."
                },
                {
                    "role": "user",
                    "content": f"Break this task into 5 subtasks: {task}"
                }
            ]
        )

        result = response.choices[0].message.content

        Subtask.query.filter_by(task_id=task_id).delete()

        for line in result.split("\n"):

            cleaned = line.strip()

            if cleaned:
                db.session.add(
                    Subtask(
                        title=cleaned,
                        task_id=task_id
                    )
                )

        db.session.commit()

        return jsonify({"steps": result})
    
    except Exception as e:
        print("AI ERROR:", str(e))
        return jsonify({"error": str(e)}), 500
