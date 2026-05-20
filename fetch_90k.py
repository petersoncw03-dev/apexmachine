import asyncio
import httpx
from datetime import datetime, timezone
import logging
from sqlalchemy.dialects.postgresql import insert
import os
from dotenv import load_dotenv
load_dotenv()

# Importa as configurações do banco de dados do seu projeto
from database import AsyncSessionLocal, Result

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Fetch90k")

def format_color(color_int: int) -> str:
    if color_int == 0: return "BRANCO"
    elif color_int == 1: return "VERMELHO"
    elif color_int == 2: return "PRETO"
    return "UNKNOWN"

def get_proxy_url():
    host = os.getenv("PROXY_HOST")
    port = os.getenv("PROXY_PORT")
    user = os.getenv("PROXY_USER")
    password = os.getenv("PROXY_PASS")
    if host and port:
        if user and password:
            return f"http://{user}:{password}@{host}:{port}"
        return f"http://{host}:{port}"
    return None

async def save_results_batch(results: list):
    if not results: return
    async with AsyncSessionLocal() as session:
        stmt = insert(Result).values(results)
        stmt = stmt.on_conflict_do_nothing(index_elements=['id'])
        await session.execute(stmt)
        await session.commit()

async def fetch_page_with_retry(client, page, end_date_str, attempt=1):
    # Domínio travado na instância brasileira (mesma roleta do WebSocket ao vivo)
    domain = "blaze.bet.br"
    url = f"https://{domain}/api/singleplayer-originals/originals/roulette_games/recent/history/1?endDate={end_date_str}&page={page}&limit=100"
    
    try:
        response = await client.get(url)
        
        # Em caso de Rate Limit (HTTP 429), aguarda mais tempo de forma exponencial
        if response.status_code == 429:
            if attempt <= 5:
                wait_time = attempt * 5.0
                logger.warning(f"⚠️ [HTTP 429] Rate limit atingido na pág. {page}. Aguardando {wait_time}s para tentar novamente (Tentativa {attempt}/5)...")
                await asyncio.sleep(wait_time)
                return await fetch_page_with_retry(client, page, end_date_str, attempt + 1)
            else:
                raise Exception("HTTP Status 429 (Rate Limit) persistente após 5 tentativas.")
                
        if response.status_code != 200:
            if attempt <= 3:
                logger.warning(f"⚠️ [HTTP {response.status_code}] Falha na pág. {page}. Tentando novamente em 3s...")
                await asyncio.sleep(3.0)
                return await fetch_page_with_retry(client, page, end_date_str, attempt + 1)
            else:
                raise Exception(f"HTTP Status {response.status_code} na página {page}.")
                
        data = response.json()
        return data.get("records", [])
        
    except Exception as e:
        if attempt <= 3:
            logger.warning(f"⚠️ Erro de conexão na pág. {page}: {e}. Retentando em 4s...")
            await asyncio.sleep(4.0)
            return await fetch_page_with_retry(client, page, end_date_str, attempt + 1)
        else:
            raise e

async def fetch_90k_history():
    logger.info("="*60)
    logger.info("🚀 [HISTORICO] INICIANDO RESGATE DE 90.000 PEDRAS (BLAZE BRASIL)...")
    logger.info("ℹ️ Método: Janela Deslizante de Data com limite de 100 por página (Fim dos Buracos)")
    logger.info("="*60)
    
    # ISO inicial com UTC
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    current_end_date = now_iso
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://blaze.bet.br/pt/games/double"
    }
    
    total_saved = 0
    target_total = 90000
    batch_size_pages = 50      # Lotes de 50 páginas (5.000 registros por lote)
    records_per_page = 100     # 100 registros por página
    proxy_url = get_proxy_url()
    
    async with httpx.AsyncClient(timeout=25.0, headers=headers, proxy=proxy_url) as client:
        while total_saved < target_total:
            logger.info(f"⏳ Iniciando lote de páginas 1 a {batch_size_pages} (endDate: {current_end_date})...")
            oldest_timestamp = None
            records_in_this_batch = 0
            
            for page in range(1, batch_size_pages + 1):
                records = await fetch_page_with_retry(client, page, current_end_date)
                
                if not records:
                    logger.warning(f"Página {page} do lote atual veio vazia. Avançando lote.")
                    break
                    
                db_records = []
                for item in records:
                    ts_str = item.get("created_at")
                    oldest_timestamp = ts_str # Rola a data continuamente até o mais antigo
                    
                    try:
                        # Faz o parse da string ISO-8601 com os milissegundos
                        dt_naive = datetime.strptime(ts_str.replace("Z", "+0000"), "%Y-%m-%dT%H:%M:%S.%f%z")
                        # Blinda UTC estrito
                        utc_dt = dt_naive.astimezone(timezone.utc)
                    except Exception:
                        utc_dt = datetime.now(timezone.utc)
                        
                    db_records.append({
                        "id": str(item["id"]),
                        "color": format_color(item["color"]),
                        "roll": item["roll"],
                        "timestamp": utc_dt,
                        "total_bets": 0.0,
                        "total_payout": 0.0,
                        "house_profit": 0.0
                    })
                    
                await save_results_batch(db_records)
                total_saved += len(db_records)
                records_in_this_batch += len(db_records)
                
                logger.info(f"📊 Lote Atual: Pág {page}/{batch_size_pages} processada. Salvo nesta pág: {len(db_records)}. Total Geral: {total_saved}/{target_total}")
                
                if total_saved >= target_total:
                    break
                    
                # Delay tranquilo de 1.8 segundos entre requisições (super seguro contra rate limits)
                await asyncio.sleep(1.8)
                
            if total_saved >= target_total:
                break
                
            if not oldest_timestamp or records_in_this_batch == 0:
                logger.info("Não há mais registros adicionais antigos disponíveis na Blaze. Encerrando.")
                break
                
            # Avança a data do próximo lote de requisições para a data do último registro retornado
            current_end_date = oldest_timestamp
            
    logger.info("="*60)
    logger.info(f"🎉 Processo concluído! Total de {total_saved} pedras salvas e blindadas em UTC no banco de dados!")
    logger.info("="*60)

if __name__ == "__main__":
    asyncio.run(fetch_90k_history())
