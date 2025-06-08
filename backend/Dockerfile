FROM python:3.12-slim

WORKDIR /app

# Update system packages to address vulnerabilities
RUN apt-get update && apt-get upgrade -y && apt-get clean

# Copy requirements.txt and install dependencies
COPY ./requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire application code
COPY ./app ./app
COPY ./models ./models
COPY .env .env

# Expose the port to be used
EXPOSE 8000

# Run the FastAPI application (ensure the 'app' object exists in main.py)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]