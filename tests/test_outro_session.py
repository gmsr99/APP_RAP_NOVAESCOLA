import pytest
from models.sqlmodel_models import AulaCreate, AulaListItem, AulaRead


def test_aula_create_accepts_participantes_ids():
    aula = AulaCreate(
        data_hora="2026-04-23 10:00",
        duracao_minutos=60,
        tipo="outro",
        participantes_ids=["uuid-1", "uuid-2"],
    )
    assert aula.participantes_ids == ["uuid-1", "uuid-2"]


def test_aula_create_defaults_participantes_ids_to_empty():
    aula = AulaCreate(
        data_hora="2026-04-23 10:00",
        duracao_minutos=60,
        tipo="pratica_escrita",
    )
    assert aula.participantes_ids == []


def test_aula_list_item_includes_participantes_ids():
    item = AulaListItem(
        id=1,
        tipo="outro",
        data_hora="2026-04-23T10:00:00",
        duracao_minutos=60,
        estado="confirmada",
        participantes_ids=["uuid-1"],
    )
    assert item.participantes_ids == ["uuid-1"]
