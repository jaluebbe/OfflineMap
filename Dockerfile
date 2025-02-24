FROM python:3.12-slim

WORKDIR /code

COPY ./offline_map/requirements.txt /code/requirements.txt
RUN apt-get update && \
    apt-get install -y libexpat1 && \
    pip install --upgrade pip && \
    pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./offline_map /code

EXPOSE 80

CMD ["uvicorn", "backend:app", "--host", "0.0.0.0", "--port", "80"]
