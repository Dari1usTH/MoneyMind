from flask import Flask, jsonify, request
import mysql.connector
from flask_cors import CORS

app = Flask(__name__)
CORS(app) 

def get_db_connection():
    return mysql.connector.connect(
        host="localhost",
        user="root",        
        password="",        
        database="moneymind"
    )

@app.route("/api/test")
def test():
    return {"message": "✅ Backend-ul Flask merge perfect și e conectat la MySQL!"}

@app.route("/verifyuserexist", methods=["GET"])
def verify_user_exist():
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
    data = cursor.fetchall()
    cursor.close()
    db.close()
    return jsonify(data)


@app.route("/adduser", methods=["POST"])
def add_user():
    data = request.get_json()
    db = get_db_connection()
    cursor = db.cursor()
    cursor.execute()
    db.commit()
    cursor.close()
    db.close()
    return "", 204


if __name__ == "__main__":
    app.run(port=5000, debug=True)
