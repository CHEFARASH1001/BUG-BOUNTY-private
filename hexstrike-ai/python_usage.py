#!/usr/bin/env python3
"""
HexStrike AI Python Usage Examples
Complete guide for using HexStrike AI programmatically
"""

import requests
import json
import time

class HexStrikeClient:
    def __init__(self, server_url="http://localhost:8888"):
        self.server_url = server_url
        
    def health_check(self):
        """Check server health and available tools"""
        response = requests.get(f"{self.server_url}/health")
        return response.json() if response.status_code == 200 else None
    
    def execute_tool(self, command, args, timeout=60):
        """Execute a security tool"""
        payload = {
            "command": command,
            "args": args,
            "timeout": timeout
        }
        
        response = requests.post(
            f"{self.server_url}/api/command",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        return response.json() if response.status_code == 200 else None
    
    def get_telemetry(self):
        """Get system performance metrics"""
        response = requests.get(f"{self.server_url}/api/telemetry")
        return response.json() if response.status_code == 200 else None

def example_reconnaissance(target):
    """Example: Complete reconnaissance workflow"""
    client = HexStrikeClient()
    
    print(f"🎯 Starting reconnaissance on {target}")
    
    # 1. Basic port scan
    print("1. Port scanning...")
    nmap_result = client.execute_tool("nmap", ["-sS", "-T4", target], timeout=120)
    if nmap_result and nmap_result['success']:
        print(f"✅ Nmap completed in {nmap_result['execution_time']:.2f}s")
    
    # 2. Web directory enumeration
    print("2. Directory enumeration...")
    gobuster_result = client.execute_tool("gobuster", [
        "dir", "-u", f"http://{target}", 
        "-w", "/usr/share/wordlists/dirb/common.txt",
        "-t", "50"
    ], timeout=300)
    
    # 3. Web vulnerability scan
    print("3. Web vulnerability scanning...")
    nikto_result = client.execute_tool("nikto", ["-h", f"http://{target}"], timeout=600)
    
    return {
        "nmap": nmap_result,
        "gobuster": gobuster_result,
        "nikto": nikto_result
    }

def example_web_testing(target_url):
    """Example: Web application security testing"""
    client = HexStrikeClient()
    
    print(f"🌐 Testing web application: {target_url}")
    
    # 1. Basic HTTP analysis
    print("1. HTTP analysis...")
    httpx_result = client.execute_tool("httpx", ["-u", target_url, "-status-code", "-title"], timeout=30)
    
    # 2. Directory brute force
    print("2. Directory brute forcing...")
    dirb_result = client.execute_tool("dirb", [target_url], timeout=300)
    
    # 3. SQL injection testing
    print("3. SQL injection testing...")
    sqlmap_result = client.execute_tool("sqlmap", [
        "-u", target_url,
        "--batch",
        "--level=1",
        "--risk=1",
        "--dbs"
    ], timeout=600)
    
    return {
        "httpx": httpx_result,
        "dirb": dirb_result,
        "sqlmap": sqlmap_result
    }

def main():
    """Main demonstration"""
    client = HexStrikeClient()
    
    # Check server health
    health = client.health_check()
    if not health:
        print("❌ Server not available!")
        return
    
    print(f"✅ Server healthy - {health['total_tools_available']} tools available")
    
    # Example 1: Simple tool execution
    print("\n" + "="*50)
    print("Example 1: Simple Nmap scan")
    result = client.execute_tool("nmap", ["-sn", "127.0.0.1"], timeout=30)
    if result:
        print(f"Success: {result['success']}")
        print(f"Output: {result['stdout'][:200]}...")
    
    # Example 2: Web testing (using a safe test site)
    print("\n" + "="*50)
    print("Example 2: Web application testing")
    web_results = example_web_testing("http://testphp.vulnweb.com")
    
    # Example 3: System telemetry
    print("\n" + "="*50)
    print("Example 3: System telemetry")
    telemetry = client.get_telemetry()
    if telemetry:
        print(f"Commands executed: {telemetry.get('commands_executed', 0)}")
        print(f"Success rate: {telemetry.get('success_rate', '0%')}")
        print(f"Average execution time: {telemetry.get('average_execution_time', '0s')}")

if __name__ == "__main__":
    main()