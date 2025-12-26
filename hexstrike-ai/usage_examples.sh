#!/bin/bash
# HexStrike AI Usage Examples

SERVER="http://localhost:8888"

echo "🔥 HexStrike AI Usage Examples"
echo "================================"

# 1. Check server health
echo "1. Server Health Check:"
curl -s "$SERVER/health" | python3 -m json.tool | head -20

echo -e "\n2. Run Nmap scan:"
curl -X POST "$SERVER/api/command" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "nmap", 
    "args": ["-sn", "192.168.1.1-10"], 
    "timeout": 30
  }' | python3 -m json.tool

echo -e "\n3. Web directory scanning with Gobuster:"
curl -X POST "$SERVER/api/command" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "gobuster", 
    "args": ["dir", "-u", "http://testphp.vulnweb.com", "-w", "/usr/share/wordlists/dirb/common.txt"], 
    "timeout": 60
  }' | python3 -m json.tool

echo -e "\n4. SQL injection testing with SQLMap:"
curl -X POST "$SERVER/api/command" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "sqlmap", 
    "args": ["-u", "http://testphp.vulnweb.com/artists.php?artist=1", "--batch", "--dbs"], 
    "timeout": 120
  }' | python3 -m json.tool

echo -e "\n5. Web vulnerability scan with Nikto:"
curl -X POST "$SERVER/api/command" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "nikto", 
    "args": ["-h", "http://testphp.vulnweb.com"], 
    "timeout": 180
  }' | python3 -m json.tool