<?php
$host = "localhost";
$user = "root";
$pass = "";
$dbname = "moneymind";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
  die(json_encode(["success" => false, "message" => "Database connection failed."]));
}

$data = json_decode(file_get_contents("php://input"), true);

$first = $conn->real_escape_string($data['firstName']);
$last = $conn->real_escape_string($data['lastName']);
$username = $conn->real_escape_string($data['username']);
$email = $conn->real_escape_string($data['email']);
$password = password_hash($data['password'], PASSWORD_DEFAULT);
$dob = !empty($data['dob']) ? $conn->real_escape_string($data['dob']) : null;
$phone = !empty($data['phone']) ? $conn->real_escape_string($data['phone']) : null;

$check = $conn->prepare("SELECT * FROM users WHERE username=? OR email=? OR phone_number=?");
$check->bind_param("sss", $username, $email, $phone);
$check->execute();
$result = $check->get_result();

if ($result->num_rows > 0) {
  echo json_encode([
    "success" => false,
    "message" => "This account already exists. Please login instead."
  ]);
  exit;
}

$stmt = $conn->prepare("
  INSERT INTO users (first_name, last_name, username, email, password, birth_date, phone_number)
  VALUES (?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("sssssss", $first, $last, $username, $email, $password, $dob, $phone);

if ($stmt->execute()) {
  echo json_encode(["success" => true, "message" => "User successfully created!"]);
} else {
  echo json_encode(["success" => false, "message" => "Error creating user."]);
}

$stmt->close();
$conn->close();
?>
