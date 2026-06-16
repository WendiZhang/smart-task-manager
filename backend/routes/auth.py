import re
from flask import Blueprint, request, jsonify
from models import db, User
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token

auth_routes = Blueprint("auth", __name__)

# REGISTER
@auth_routes.route("/register", methods=["POST"])
def register():
    data = request.json or {}

    username = data.get("username")

    if not username:
        return jsonify({"error": "Missing username"}), 400

    username = username.strip().lower()
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400
    
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if not re.search(r"[A-Za-z]", password):
        return jsonify({"error": "Password must contain at least one letter"}), 400

    if not re.search(r"\d", password):
        return jsonify({"error": "Password must contain at least one number"}), 400

    try:
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({"error": "Username already exists"}), 409
        
        hashed_pw = generate_password_hash(password, method="pbkdf2:sha256")

        user = User(username=username, password=hashed_pw)

        db.session.add(user)
        db.session.commit()

        return jsonify({"msg": "User created"}), 201

    except Exception as e:
        print("REGISTER ERROR:", str(e))
        return jsonify({"error": str(e)}), 500


# LOGIN
@auth_routes.route("/login", methods=["POST"])
def login():
    data = request.json or {}

    username = data.get("username")
    if not username:
        return jsonify({"error": "Missing username"}), 400

    username = username.strip().lower()
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Missing fields"}), 400

    user = User.query.filter_by(username=username.strip().lower()).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not check_password_hash(user.password, password):
        return jsonify({"error": "Wrong password"}), 401
    
    token = create_access_token(identity=str(user.id))

    return jsonify({
        "token": token,
        "user_id": user.id
    }), 200