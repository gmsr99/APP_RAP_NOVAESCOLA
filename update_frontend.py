import os
import subprocess
import sys

# ==============================================================================
# SCRIPT DE ATUALIZAÇÃO DO FRONTEND
# ==============================================================================
# Repositório: https://github.com/eltonmalta/bpm-rap-nova-escola.git
# ==============================================================================

REPO_URL = "https://github.com/eltonmalta/bpm-rap-nova-escola.git"
FRONTEND_DIR = "bpm-rap-nova-escola"

def run_git_command(args, cwd=None):
    """Executa um comando git e imprime o output."""
    try:
        cmd = ["git"] + args
        print(f"🔄 A executar: {' '.join(cmd)}...")
        result = subprocess.run(
            cmd,
            cwd=cwd,
            check=True,
            text=True,
            capture_output=True
        )
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro ao executar git: {e.stderr}")
        return False
    except FileNotFoundError:
        print("❌ Erro: Git não encontrado no sistema. Instala o Git primeiro.")
        return False

def main():
    print("🚀 Iniciando gestão do Frontend...")
    
    if os.path.exists(FRONTEND_DIR):
        print(f"📂 Diretório '{FRONTEND_DIR}' encontrado. A atualizar...")
        if run_git_command(["pull"], cwd=FRONTEND_DIR):
            print("✅ Frontend atualizado com sucesso!")
    else:
        print(f"📂 Diretório '{FRONTEND_DIR}' não encontrado. A clonar...")
        if run_git_command(["clone", REPO_URL]):
            print("✅ Frontend clonado com sucesso!")
            
    print("🏁 Operação concluída.")

if __name__ == "__main__":
    main()
