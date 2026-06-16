# Smart Task Manager

An AI-powered task management application built with React and Flask.

## Features

- User authentication with JWT
- Create, edit, and delete tasks
- Mark tasks as completed
- Drag-and-drop task reordering
- AI-generated task breakdowns
- Expand/collapse subtasks
- Clear AI-generated steps

## Tech Stack

### Frontend
- React
- React Router
- Tailwind CSS
- @hello-pangea/dnd

### Backend
- Flask
- SQLAlchemy
- JWT Authentication

### AI
- OpenAI API

## Installation

### Backend

```bash
cd backend

python -m venv venv

source venv/bin/activate
# Windows:
# venv\Scripts\activate

pip install -r requirements.txt

flask run
```

### Frontend

```bash
cd frontend

npm install

npm run dev
```
