from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, get_db

# We use a TestClient to simulate API requests
client = TestClient(app)

def test_database_connection():
    """Verify that the engine can connect to the database."""
    connection = engine.connect()
    assert connection is not None
    connection.close()