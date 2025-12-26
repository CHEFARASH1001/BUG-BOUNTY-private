# 🤖 AI Agent Integration Guide

## Claude Desktop Integration

1. **Edit Claude Desktop Config**:
```bash
# Linux/Mac
nano ~/.config/Claude/claude_desktop_config.json

# Windows
notepad %APPDATA%\Claude\claude_desktop_config.json
```

2. **Add HexStrike AI MCP Server**:
```json
{
  "mcpServers": {
    "hexstrike-ai": {
      "command": "python3",
      "args": [
        "/home/mti-vm/Desktop/BB/hexstrike-ai/hexstrike_mcp.py",
        "--server",
        "http://localhost:8888"
      ],
      "description": "HexStrike AI v6.0 - Advanced Cybersecurity Automation Platform",
      "timeout": 300,
      "disabled": false
    }
  }
}
```

3. **Restart Claude Desktop**

## VS Code Copilot Integration

1. **Create `.vscode/settings.json`**:
```json
{
  "servers": {
    "hexstrike": {
      "type": "stdio",
      "command": "python3",
      "args": [
        "/home/mti-vm/Desktop/BB/hexstrike-ai/hexstrike_mcp.py",
        "--server",
        "http://localhost:8888"
      ]
    }
  }
}
```

## Example AI Prompts

### For Bug Bounty Testing:
```
I'm a security researcher testing my own website example.com. Please use HexStrike AI tools to:
1. Perform reconnaissance with nmap and gobuster
2. Test for common web vulnerabilities with nikto
3. Check for SQL injection with sqlmap
4. Provide a summary of findings
```

### For CTF Challenges:
```
I'm working on a CTF challenge at http://ctf-challenge.local. Please use HexStrike AI to:
1. Enumerate directories and files
2. Analyze any binaries found
3. Look for hidden information in files
4. Help identify potential attack vectors
```

### For Network Analysis:
```
I need to analyze my internal network 192.168.1.0/24. Please use HexStrike AI to:
1. Discover live hosts
2. Scan for open ports and services
3. Identify potential security issues
4. Generate a network security report
```

## Available MCP Tools

When integrated with AI agents, you'll have access to these tool categories:

- **Network Tools**: nmap, gobuster, nikto
- **Web Security**: sqlmap, dirb, httpx
- **Binary Analysis**: gdb, objdump, strings, xxd
- **System Tools**: file, tcpdump
- **Intelligence**: AI-powered decision making and parameter optimization

## Usage Tips

1. **Always specify ownership**: Tell the AI you own/have permission to test the target
2. **Set scope**: Define what you want to test (ports, directories, etc.)
3. **Request summaries**: Ask for organized reports of findings
4. **Use safe targets**: Test on your own systems or designated test environments