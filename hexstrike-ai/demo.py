#!/usr/bin/env python3
"""
HexStrike AI Demo Script
Demonstrates the basic functionality of the HexStrike AI system
"""

import requests
import json
import time

# HexStrike AI server URL
SERVER_URL = "http://localhost:8888"

def test_health():
    """Test server health endpoint"""
    print("🏥 Testing server health...")
    response = requests.get(f"{SERVER_URL}/health")
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Server Status: {data['status']}")
        print(f"📊 Version: {data['version']}")
        print(f"🛠️  Available Tools: {data['total_tools_available']}/{data['total_tools_count']}")
        return True
    else:
        print(f"❌ Health check failed: {response.status_code}")
        return False

def run_command(command, args, timeout=30):
    """Run a command through the HexStrike API"""
    print(f"🚀 Running: {command} {' '.join(args)}")
    
    payload = {
        "command": command,
        "args": args,
        "timeout": timeout
    }
    
    response = requests.post(f"{SERVER_URL}/api/command", 
                           json=payload,
                           headers={"Content-Type": "application/json"})
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Success: {data['success']}")
        print(f"⏱️  Execution time: {data['execution_time']:.2f}s")
        if data['stdout']:
            print(f"📤 Output:\n{data['stdout'][:500]}...")
        if data['stderr']:
            print(f"⚠️  Errors:\n{data['stderr'][:200]}...")
        return data
    else:
        print(f"❌ Command failed: {response.status_code}")
        return None

def main():
    """Main demo function"""
    print("🔥 HexStrike AI Demo Starting...")
    print("=" * 50)
    
    # Test server health
    if not test_health():
        return
    
    print("\n" + "=" * 50)
    
    # Test basic commands
    commands_to_test = [
        ("echo", ["HexStrike AI is running!"]),
        ("whoami", []),
        ("pwd", []),
        ("ls", ["-la", "/tmp"]),
    ]
    
    for command, args in commands_to_test:
        print(f"\n{'='*20}")
        run_command(command, args)
        time.sleep(1)
    
    print("\n" + "=" * 50)
    print("🎯 Demo completed! HexStrike AI is ready for cybersecurity operations.")
    print("📚 Available endpoints:")
    print("   - GET  /health - Server health check")
    print("   - POST /api/command - Execute security tools")
    print("   - GET  /api/telemetry - System metrics")
    print("   - GET  /api/cache/stats - Cache statistics")

if __name__ == "__main__":
    main()