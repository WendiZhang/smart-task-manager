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
CORS(
    app,
    origins=[
        "http://localhost:5173",
        "https://smart-task-manager-ebon.vercel.app"
    ]
)
jwt = JWTManager(app)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "sqlite:///tasks.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")

db.init_app(app)

# Register routes
app.register_blueprint(task_routes, url_prefix="/tasks")

app.register_blueprint(ai_routes, url_prefix="/ai")

app.register_blueprint(auth_routes, url_prefix="/auth")

# Create tables
with app.app_context():
    db.create_all()

@app.route("/")
def home():
    return "API is running with database"

if __name__ == "__main__":
    app.run(debug=True)