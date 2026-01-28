import pandas as pd
import json
import os

def verificar_chamados(excel_path, json_path):
    print("--- Iniciando Verificação ---")

    # 1. Ler o arquivo Excel
    try:
        # Lê apenas a coluna B (usecols="B").
        # dtype=str garante que números sejam lidos como texto para comparação precisa
        df = pd.read_excel(excel_path, usecols="B", dtype=str)

        # Pega o nome da coluna (que é o header, ex: B1)
        col_name = df.columns[0]

        # Converte para uma lista e remove valores vazios (NaN) e espaços em branco
        chamados_xls = df[col_name].dropna().str.strip().tolist()

        print(f"Total de chamados encontrados no Excel: {len(chamados_xls)}")

    except FileNotFoundError:
        print(f"ERRO: Arquivo Excel não encontrado: {excel_path}")
        return
    except Exception as e:
        print(f"ERRO ao ler Excel: {e}")
        return

    # 2. Ler o arquivo JSON
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            conteudo_json = json.load(f)

        # Navega até a lista: data -> ticket_assignments
        # Ajuste aqui se a estrutura raiz for diferente, mas baseada no seu pedido:
        try:
            lista_chamados_json = conteudo_json['data']['ticket_assignments']
        except KeyError:
            print("ERRO: Estrutura do JSON não corresponde a 'data.ticket_assignments'")
            return

        # Cria um SET (conjunto) com os activity_number para busca rápida
        # Também converte para string e remove espaços
        chamados_json_set = set()
        for item in lista_chamados_json:
            if 'activity_number' in item:
                chamados_json_set.add(str(item['activity_number']).strip())

        print(f"Total de chamados encontrados no JSON: {len(chamados_json_set)}")

    except FileNotFoundError:
        print(f"ERRO: Arquivo JSON não encontrado: {json_path}")
        return
    except Exception as e:
        print(f"ERRO ao ler JSON: {e}")
        return

    # 3. Comparação: O que está no XLS mas NÃO está no JSON
    # Usamos set difference para isso
    chamados_faltantes = [chamado for chamado in chamados_xls if chamado not in chamados_json_set]

    print("\n--- Resultado da Análise ---")

    if not chamados_faltantes:
        print("✅ SUCESSO: Todos os chamados do Excel estão presentes no JSON.")
    else:
        print(f"❌ ATENÇÃO: Foram encontrados {len(chamados_faltantes)} chamados no Excel que NÃO estão no JSON:")
        for chamado in chamados_faltantes:
            print(f" - {chamado}")

# --- Configuração dos Arquivos ---
# Altere os nomes abaixo para os nomes reais dos seus arquivos
arquivo_excel = 'chamados.xls'
arquivo_json = 'chamados.json'

if __name__ == "__main__":
    verificar_chamados(arquivo_excel, arquivo_json)