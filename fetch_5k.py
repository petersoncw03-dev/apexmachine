import asyncio
import httpx
from datetime import datetime, timezone
import logging
from sqlalchemy.dialects.postgresql import insert
import os
from dotenv import load_dotenv

# Importa as configurações do banco de dados do seu projeto
from database import AsyncSessionLocal, Result

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Fetch5k")

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
        
        # Em caso de Rate Limit (HTTP 429), aguarda mais tempo e tenta novamente
        if response.status_code == 429:
            if attempt <= 5:
                wait_time = attempt * 3.0
                logger.warning(f"⚠️ [HTTP 429] Rate limit atingido na pág. {page}. Aguardando {wait_time}s para tentar novamente (Tentativa {attempt}/5)...")
                await asyncio.sleep(wait_time)
                return await fetch_page_with_retry(client, page, end_date_str, attempt + 1)
            else:
                raise Exception("HTTP Status 429 (Rate Limit) persistente após 5 tentativas.")
                
        if response.status_code != 200:
            if attempt <= 3:
                logger.warning(f"⚠️ [HTTP {response.status_code}] Falha na pág. {page}. Tentando novamente em 2s...")
                await asyncio.sleep(2.0)
                return await fetch_page_with_retry(client, page, end_date_str, attempt + 1)
            else:
                raise Exception(f"HTTP Status {response.status_code} na página {page}.")
                
        data = response.json()
        return data.get("records", [])
        
    except Exception as e:
        if attempt <= 3:
            logger.warning(f"⚠️ Erro de conexão na pág. {page}: {e}. Retentando em 3s...")
            await asyncio.sleep(3.0)
            return await fetch_page_with_retry(client, page, end_date_str, attempt + 1)
        else:
            raise e

async def fetch_5k_history():
    logger.info("="*60)
    logger.info("🚀 [HISTORICO] INICIANDO O RESGATE DE 5.000 PEDRAS RECENTES (BLAZE BRASIL)...")
    logger.info("="*60)
    
    # ISO com sufixo Z estrito para marcar UTC no payload
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://blaze.bet.br/pt/games/double"
    }
    
    total_saved = 0
    pages_to_fetch = 250  # 250 páginas * 20 registros = 5.000 pedras
    proxy_url = get_proxy_url()
    
    async with httpx.AsyncClient(timeout=20.0, headers=headers, proxy=proxy_url) as client:
        for page in range(1, pages_to_fetch + 1):
            records = await fetch_page_with_retry(client, page, now_iso)
            
            if not records:
                logger.warning(f"Página {page} veio vazia. Parando busca.")
                break
                
            db_records = []
            for item in records:
                try:
                    ts_str = item.get("created_at")
                    # Faz o parse da string ISO-8601 preservando os milissegundos
                    dt_naive = datetime.strptime(ts_str.replace("Z", "+0000"), "%Y-%m-%dT%H:%M:%S.%f%z")
                    # Garante e blinda que o fuso horário seja estritamente UTC para o PostgreSQL
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
            
            if page % 10 == 0 or page == pages_to_fetch:
                logger.info(f"📊 Página {page}/{pages_to_fetch} salva. Total até agora: {total_saved} pedras.")
            
            # Delay anti-rate-limit estrito para estabilidade na paginação profunda
            await asyncio.sleep(1.5)
            
    logger.info("="*60)
    logger.info(f"🎉 Resgate concluído! {total_saved} pedras salvas em UTC estrito com sucesso.")
    logger.info("="*60)

if __name__ == "__main__":
    asyncio.run(fetch_5k_history())
