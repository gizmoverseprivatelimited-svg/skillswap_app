import subprocess
import sys

def login():
    try:
        print("Starting login process...")
        process = subprocess.run(
            ['npx.cmd', 'expo', 'login', '-u', 'shersingh741730@gmail.com', '-p', '@Expo1234&&$$'],
            capture_output=True,
            text=True
        )
        print("STDOUT:", process.stdout)
        print("STDERR:", process.stderr)
        print("Return code:", process.returncode)
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    login()
