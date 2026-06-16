import os
from dotenv import load_dotenv

load_dotenv()

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from models import db
from routes.tasks import task_routes
from routes.ai import ai_routes
from routes.auth import auth_routes

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "sqlite:///tasks.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

db.init_app(app)
jwt = JWTManager(app)

CORS(
    app,
    resources={r"/*": {"origins": [
        "http://localhost:5173",
        "https://smart-task-manager-ebon.vercel.app"
    ]}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)

# Register routes
app.register_blueprint(task_routes, url_prefix="/tasks")

app.register_blueprint(ai_routes, url_prefix="/ai")

app.register_blueprint(auth_routes, url_prefix="/auth")

@app.route("/")
def home():
    return "working"

@app.after_request
def after_request(response):
    return response

with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
