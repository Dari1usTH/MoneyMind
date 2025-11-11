import mysql.connector

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="",
    database="moneymind"
)

cursor = db.cursor()

print("Connection with database succesfull")

cursor.close()
db.close()