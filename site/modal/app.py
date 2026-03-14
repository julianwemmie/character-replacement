"""Site-specific Modal functions for the character replacement service."""

import modal

app = modal.App("character-replacement-site")


@app.function()
def health_check() -> dict:
    """Health check endpoint for the Modal app."""
    return {"status": "ok"}
