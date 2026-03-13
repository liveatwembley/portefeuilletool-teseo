import logging

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.dependencies import get_db
from core.database import get_all_snapshots

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post('/live-refresh')
def live_refresh(db=Depends(get_db), user=Depends(get_current_user)):
    from core.live_refresh import refresh_live_snapshot
    return refresh_live_snapshot(db)


@router.get('/sheets/list')
def list_sheets(user=Depends(get_current_user)):
    from core.import_sheets import list_spreadsheets
    try:
        return list_spreadsheets()
    except Exception as e:
        logger.error("Fout bij laden spreadsheets: %s", e)
        raise HTTPException(status_code=500, detail=f"Kan spreadsheets niet laden: {str(e)}")


@router.get('/sheets/{sheet_id}/tabs')
def list_tabs(sheet_id: str, user=Depends(get_current_user)):
    from core.import_sheets import list_available_tabs
    tabs = list_available_tabs(sheet_id=sheet_id)
    # Verwijder worksheet object (niet serializable)
    return [
        {
            'tab_name': t['tab_name'],
            'date': t['date'],
            'spreadsheet': t['spreadsheet'],
            'sheet_id': t['sheet_id'],
        }
        for t in tabs
    ]


@router.post('/sheets/import')
def import_tab(sheet_id: str, tab_name: str, db=Depends(get_db), user=Depends(get_current_user)):
    from core.import_sheets import list_available_tabs, import_specific_tab
    try:
        tabs = list_available_tabs(sheet_id=sheet_id)
    except Exception as e:
        logger.error("Fout bij ophalen tabs voor import: %s", e)
        raise HTTPException(status_code=500, detail=f"Kan tabs niet laden: {str(e)}")
    target = None
    for t in tabs:
        if t['tab_name'] == tab_name:
            target = t
            break
    if not target:
        raise HTTPException(status_code=404, detail=f'Tab "{tab_name}" niet gevonden')
    try:
        return import_specific_tab(db, target)
    except Exception as e:
        logger.error("Fout bij import van %s: %s", tab_name, e)
        raise HTTPException(status_code=500, detail=f"Import mislukt: {str(e)}")


@router.get('/history')
def sync_history(db=Depends(get_db), user=Depends(get_current_user)):
    snapshots = get_all_snapshots(db)
    return snapshots[:15]
