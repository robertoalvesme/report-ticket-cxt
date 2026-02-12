import pandas as pd

# --- CONFIGURAÇÃO ---
# Se os seus arquivos tiverem nomes diferentes, altere aqui:
ARQUIVO_1 = 'report.xlsx'
COLUNA_1  = 'SR#'

ARQUIVO_2 = 'incoming.xls'
COLUNA_2  = 'Work Item'
# ---------------------

def validar_planilhas():
    print("Iniciando leitura dos arquivos...")

    try:
        # Lendo arquivos Excel
        # O pandas usa a biblioteca 'openpyxl' para .xlsx e 'xlrd' para .xls
        df1 = pd.read_excel(ARQUIVO_1)
        df2 = pd.read_excel(ARQUIVO_2)
    except FileNotFoundError as e:
        print(f"Erro: Arquivo não encontrado. Verifique se os nomes estão corretos.")
        print(f"Detalhe: {e}")
        return
    except Exception as e:
        print(f"Erro inesperado ao ler os arquivos: {e}")
        return

    # Extraindo os números e garantindo que sejam strings sem espaços vazios
    # Usamos .dropna() para ignorar linhas vazias se houver
    set1 = set(df1[COLUNA_1].dropna().astype(str).str.strip())
    set2 = set(df2[COLUNA_2].dropna().astype(str).str.strip())

    # Comparação
    somente_p1 = set1 - set2
    somente_p2 = set2 - set1
    em_ambas = set1.intersection(set2)

    # Exibição dos resultados
    print("\n" + "="*50)
    print("           RELATÓRIO DE COMPARAÇÃO")
    print("="*50)
    print(f"Planilha 1 ({ARQUIVO_1}): {len(set1)} registros encontrados.")
    print(f"Planilha 2 ({ARQUIVO_2}): {len(set2)} registros encontrados.")
    print("-" * 50)
    print(f"Total de chamados em AMBAS: {len(em_ambas)}")
    print("-" * 50)

    print(f"\nChamados presentes APENAS em: {ARQUIVO_1} ({len(somente_p1)})")
    if somente_p1:
        print(sorted(list(somente_p1)))
    else:
        print("Nenhum")

    print(f"\nChamados presentes APENAS em: {ARQUIVO_2} ({len(somente_p2)})")
    if somente_p2:
        print(sorted(list(somente_p2)))
    else:
        print("Nenhum")
    print("="*50)

if __name__ == '__main__':
    validar_planilhas()