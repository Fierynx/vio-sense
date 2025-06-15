### Setup + Start FE

```
cd frontend
npm install
npm run dev
```

### Setup + Start BE 

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Dataset:
https://www.kaggle.com/datasets/mohamedmustafa/real-life-violence-situations-dataset/code?datasetId=176381

### Deep Learning Reference:
https://www.kaggle.com/code/abduulrahmankhalid/real-time-violence-detection-mobilenet-bi-lstm
