#!venv/bin/python
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import routers.offline_map as offline_map
import routers.coordinates as coordinates
import routers.locations as locations

app = FastAPI()
app.mount("/static", StaticFiles(directory="static", html=True), name="static")
app.mount("/fonts", StaticFiles(directory="fonts"), name="fonts")

app.include_router(offline_map.router)
app.include_router(coordinates.router)
app.include_router(locations.router)


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse("/static/leaflet_map.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
