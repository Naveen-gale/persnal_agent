import os
import sys
from pathlib import Path

# Add personal-agent/agent to Python path
current_dir = Path(__file__).resolve().parent
agent_dir = current_dir.parent / "personal-agent" / "agent"
sys.path.insert(0, str(agent_dir))

# Import the FastAPI app from the core agent package
from server import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", os.getenv("AGENT_PORT", "8000")))
    host = os.getenv("AGENT_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
