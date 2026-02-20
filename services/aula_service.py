"""
Serviço de aulas migrado para SQLModel.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Union

from sqlmodel import Session, select

from database.connection import get_db_connection
from database.database import engine
from models.sqlmodel_models import (
    Aula,
    AulaListItem,
    AulaRead,
    Estabelecimento,
    Mentor,
    Projeto,
    Turma,
)

# ============================================================================
# CONSTANTES - ESTADOS DAS AULAS
# ============================================================================

ESTADO_RASCUNHO = "rascunho"
ESTADO_PENDENTE = "pendente"
ESTADO_CONFIRMADA = "confirmada"
ESTADO_RECUSADA = "recusada"
ESTADO_EM_CURSO = "em_curso"
ESTADO_CONCLUIDA = "concluida"
ESTADO_CANCELADA = "cancelada"
ESTADO_TERMINADA = "terminada"

ESTADOS_VALIDOS = [
    ESTADO_RASCUNHO,
    ESTADO_PENDENTE,
    ESTADO_CONFIRMADA,
    ESTADO_RECUSADA,
    ESTADO_EM_CURSO,
    ESTADO_CONCLUIDA,
    ESTADO_CANCELADA,
    ESTADO_TERMINADA,
]

TIPOS_AULA = [
    "teorica",
    "pratica_escrita",
    "pratica_gravacao",
    "producao_musical",
    "ensaio",
    "showcase",
]


def _resolver_atividade(atividade_id):
    """Resolve atividade_id → (atividade_nome, disciplina_nome) via raw SQL."""
    if not atividade_id:
        return None, None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT a.nome, d.nome
            FROM atividades a
            LEFT JOIN disciplinas d ON a.disciplina_id = d.id
            WHERE a.id = %s
        """, (atividade_id,))
        row = cur.fetchone()
        if row:
            return row[0], row[1]
        return None, None
    except Exception:
        return None, None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def _resolver_atividades_bulk(atividade_ids):
    """Resolve multiple atividade_ids at once → {id: (atividade_nome, disciplina_nome)}."""
    ids = [aid for aid in atividade_ids if aid is not None]
    if not ids:
        return {}
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        placeholders = ','.join(['%s'] * len(ids))
        cur.execute(f"""
            SELECT a.id, a.nome, d.nome
            FROM atividades a
            LEFT JOIN disciplinas d ON a.disciplina_id = d.id
            WHERE a.id IN ({placeholders})
        """, ids)
        return {row[0]: (row[1], row[2]) for row in cur.fetchall()}
    except Exception:
        return {}
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def _parse_data_hora(data_hora: Union[str, datetime]) -> datetime:
    if isinstance(data_hora, datetime):
        return data_hora

    if isinstance(data_hora, str):
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
            try:
                return datetime.strptime(data_hora, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(data_hora)
        except ValueError as exc:
            raise ValueError("Formato de data_hora inválido") from exc

    raise ValueError("data_hora deve ser string ou datetime")


def _to_aula_read_dict(aula: Aula) -> Dict[str, Any]:
    return AulaRead.model_validate(aula).model_dump()


TIPOS_ATIVIDADE_AUTONOMA = [
    "Produção Musical",
    "Preparação Aulas",
    "Edição/Captura",
    "Reunião",
    "Manutenção",
]


def criar_aula(
    turma_id,
    data_hora,
    tipo="pratica_escrita",
    duracao_minutos=90,
    mentor_id=None,
    local=None,
    tema=None,
    objetivos=None,
    projeto_id=None,
    observacoes=None,
    atividade_id=None,
    is_autonomous=False,
    is_realized=False,
    tipo_atividade=None,
    responsavel_user_id=None,
    musica_id=None,
):
    if not is_autonomous and not turma_id:
        print("❌ Erro: turma_id é obrigatório para aulas regulares!")
        return None

    if not data_hora:
        print("❌ Erro: data_hora é obrigatória!")
        return None

    if not is_autonomous and tipo not in TIPOS_AULA:
        print(f"⚠️  Aviso: Tipo '{tipo}' não é padrão. Tipos válidos: {TIPOS_AULA}")

    if is_autonomous:
        estado_inicial = "autonomo"
    else:
        estado_inicial = ESTADO_PENDENTE if mentor_id else ESTADO_RASCUNHO

    try:
        data_hora_dt = _parse_data_hora(data_hora)

        with Session(engine) as session:
            nova_aula = Aula(
                turma_id=turma_id,
                mentor_id=mentor_id,
                projeto_id=projeto_id,
                tipo=tipo if not is_autonomous else "trabalho_autonomo",
                data_hora=data_hora_dt,
                duracao_minutos=duracao_minutos,
                estado=estado_inicial,
                local=local,
                tema=tema,
                objetivos=objetivos,
                observacoes=observacoes,
                atividade_id=atividade_id,
                is_autonomous=is_autonomous,
                is_realized=is_realized,
                tipo_atividade=tipo_atividade,
                responsavel_user_id=responsavel_user_id,
                musica_id=musica_id,
            )
            session.add(nova_aula)
            session.commit()
            session.refresh(nova_aula)

        print(f"✅ Aula #{nova_aula.id} criada com sucesso!")

        if mentor_id and not is_autonomous:
            try:
                from services import notification_service, profile_service, turma_service

                email_mentor = turma_service.obter_email_mentor(mentor_id)
                if email_mentor:
                    profile_id = profile_service.obter_profile_id_por_email(email_mentor)
                    if profile_id:
                        notification_service.criar_notificacao(
                            user_id=profile_id,
                            tipo="session_created",
                            titulo="Nova Sessão Atribuída",
                            mensagem=f"Foi-lhe atribuída uma nova sessão a {data_hora_dt}.",
                            link="/horarios",
                            metadados={"aula_id": nova_aula.id},
                        )
            except Exception as e:
                print(f"⚠️ Erro ao criar notificação: {e}")

        return _to_aula_read_dict(nova_aula)

    except Exception as e:
        print(f"❌ Erro ao criar aula: {e}")
        return None


def criar_aulas_recorrentes(
    data_hora,
    duracao_minutos,
    tipo_atividade,
    responsavel_user_id,
    observacoes,
    semanas,
):
    """Cria N sessões de trabalho autónomo com intervalo semanal."""
    from datetime import timedelta

    data_hora_dt = _parse_data_hora(data_hora)
    resultados = []
    for i in range(semanas):
        data = data_hora_dt + timedelta(weeks=i)
        resultado = criar_aula(
            turma_id=None,
            data_hora=data,
            duracao_minutos=duracao_minutos,
            is_autonomous=True,
            tipo_atividade=tipo_atividade,
            responsavel_user_id=responsavel_user_id,
            observacoes=observacoes,
        )
        if resultado:
            resultados.append(resultado)
    print(f"✅ {len(resultados)} sessões recorrentes criadas.")
    return resultados


def listar_aulas_por_estado(estado, limite=50):
    if estado not in ESTADOS_VALIDOS:
        print(f"⚠️  Aviso: Estado '{estado}' pode não ser válido.")
        print(f"   Estados válidos: {ESTADOS_VALIDOS}")

    try:
        with Session(engine) as session:
            statement = (
                select(Aula, Turma, Estabelecimento, Mentor)
                .outerjoin(Turma, Aula.turma_id == Turma.id)
                .outerjoin(Estabelecimento, Turma.estabelecimento_id == Estabelecimento.id)
                .outerjoin(Mentor, Aula.mentor_id == Mentor.id)
                .where(Aula.estado == estado)
                .order_by(Aula.data_hora.desc())
                .limit(limite)
            )
            rows = session.exec(statement).all()

        # Resolver nomes de atividade/disciplina em bulk
        atividade_map = _resolver_atividades_bulk([a.atividade_id for a, *_ in rows])

        aulas: List[Dict[str, Any]] = []
        for aula, turma, estabelecimento, mentor in rows:
            atv_nome, disc_nome = atividade_map.get(aula.atividade_id, (None, None))
            payload = {
                "id": aula.id,
                "tipo": aula.tipo,
                "data_hora": aula.data_hora,
                "duracao_minutos": aula.duracao_minutos,
                "estado": aula.estado,
                "local": aula.local,
                "tema": aula.tema,
                "objetivos": aula.objetivos,
                "observacoes": aula.observacoes,
                "criado_em": aula.criado_em,
                "turma_nome": turma.nome if turma else None,
                "turma_id": turma.id if turma else None,
                "mentor_nome": mentor.nome if mentor else None,
                "mentor_id": mentor.id if mentor else None,
                "mentor_user_id": str(mentor.user_id) if mentor and mentor.user_id else None,
                "estabelecimento_nome": estabelecimento.nome if estabelecimento else None,
                "estabelecimento_sigla": estabelecimento.sigla if estabelecimento else None,
                "atualizado_em": aula.atualizado_em,
                "projeto_nome": None,
                "atividade_id": aula.atividade_id,
                "atividade_nome": atv_nome,
                "disciplina_nome": disc_nome,
                "equipamento_nome": None,
                "is_autonomous": aula.is_autonomous,
                "is_realized": aula.is_realized,
                "tipo_atividade": aula.tipo_atividade,
                "responsavel_user_id": aula.responsavel_user_id,
                "musica_id": aula.musica_id,
                "avaliacao": aula.avaliacao,
                "obs_termino": aula.obs_termino,
            }
            aulas.append(AulaListItem.model_validate(payload).model_dump())

        print(f"📋 {len(aulas)} aula(s) encontrada(s) com estado '{estado}'")
        return aulas

    except Exception as e:
        print(f"❌ Erro ao listar aulas: {e}")
        return []


def atribuir_mentor(aula_id, mentor_id):
    if not aula_id or not mentor_id:
        print("❌ Erro: aula_id e mentor_id são obrigatórios!")
        return False

    try:
        with Session(engine) as session:
            # ORM: session.get traduz-se num SELECT ... WHERE id = ? LIMIT 1.
            aula = session.get(Aula, aula_id)
            if not aula:
                print(f"❌ Erro: Aula #{aula_id} não encontrada!")
                return False

            estado_atual = aula.estado
            mentor_atual = aula.mentor_id

            if estado_atual == ESTADO_RASCUNHO and not mentor_atual:
                aula.estado = ESTADO_PENDENTE

            aula.mentor_id = mentor_id
            aula.atualizado_em = datetime.utcnow()

            # ORM: ao fazer commit, o SQLAlchemy emite UPDATE apenas das colunas alteradas.
            session.add(aula)
            session.commit()

            mentor = session.get(Mentor, mentor_id)
            mentor_nome = mentor.nome if mentor else f"Mentor #{mentor_id}"

        print(f"✅ Mentor '{mentor_nome}' atribuído à aula #{aula_id}")

        try:
            from notifications import slack_service
            from services import notification_service, profile_service, turma_service

            aula_data = obter_aula_por_id(aula_id)
            if aula_data:
                slack_service.notificar_aula_atribuida(
                    aula_id=aula_id,
                    mentor_nome=aula_data.get("mentor_nome"),
                    turma_nome=aula_data.get("turma_nome"),
                    data_hora=aula_data.get("data_hora"),
                    tipo_aula=aula_data.get("tipo"),
                    estabelecimento_nome=aula_data.get("estabelecimento_nome"),
                    tema=aula_data.get("tema"),
                )

                email_mentor = turma_service.obter_email_mentor(mentor_id)
                if email_mentor:
                    profile_id = profile_service.obter_profile_id_por_email(email_mentor)
                    if profile_id:
                        notification_service.criar_notificacao(
                            user_id=profile_id,
                            tipo="session_created",
                            titulo="Nova Sessão Atribuída",
                            mensagem=(
                                f"Foi-lhe atribuída a sessão de '{aula_data['turma_nome']}' "
                                f"a {aula_data['data_hora']}."
                            ),
                            link="/horarios",
                            metadados={"aula_id": aula_id},
                        )
        except Exception as e:
            print(f"⚠️  Aviso: Erro ao enviar notificação: {e}")

        return True

    except Exception as e:
        print(f"❌ Erro ao atribuir mentor: {e}")
        return False


def mudar_estado_aula(aula_id, novo_estado, observacao=None):
    if novo_estado not in ESTADOS_VALIDOS:
        print(f"❌ Erro: Estado '{novo_estado}' não é válido!")
        print(f"   Estados válidos: {ESTADOS_VALIDOS}")
        return False

    try:
        with Session(engine) as session:
            # ORM: session.get carrega a aula e a alteração do atributo estado vira UPDATE no commit.
            aula = session.get(Aula, aula_id)
            if not aula:
                print(f"❌ Erro: Aula #{aula_id} não encontrada!")
                return False

            estado_anterior = aula.estado
            nota_mudanca = (
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] "
                f"Estado: '{estado_anterior}' → '{novo_estado}'"
            )
            if observacao:
                nota_mudanca += f" | {observacao}"

            aula.estado = novo_estado
            aula.observacoes = (
                f"{aula.observacoes}\n{nota_mudanca}" if aula.observacoes else nota_mudanca
            )
            aula.atualizado_em = datetime.utcnow()

            session.add(aula)
            session.commit()

        print(f"✅ Estado da aula #{aula_id} atualizado: '{estado_anterior}' → '{novo_estado}'")

        if novo_estado in [ESTADO_CONFIRMADA, ESTADO_RECUSADA]:
            try:
                from services import notification_service, profile_service

                perfis = profile_service.listar_perfis()
                coordenadores_ids = [p["id"] for p in perfis if p.get("role") == "coordenador"]

                aula_info = obter_aula_por_id(aula_id)
                mentor_nome = aula_info["mentor_nome"] if aula_info else "Um mentor"
                titulo = (
                    "Sessão Confirmada" if novo_estado == ESTADO_CONFIRMADA else "Sessão Recusada"
                )
                msg = f"{mentor_nome} {novo_estado} a sessão de {aula_info['data_hora']}."

                for coord_id in coordenadores_ids:
                    notification_service.criar_notificacao(
                        user_id=coord_id,
                        tipo=f"session_{novo_estado}",
                        titulo=titulo,
                        mensagem=msg,
                        link="/horarios",
                        metadados={"aula_id": aula_id},
                    )
            except Exception as e:
                print(f"⚠️ Erro ao enviar notificação ao coordenador: {e}")

        return True

    except Exception as e:
        print(f"❌ Erro ao mudar estado: {e}")
        return False


def terminar_aula(aula_id, avaliacao, obs_termino=None):
    """Marca uma sessão presencial confirmada como terminada, com avaliação."""
    if not 1 <= avaliacao <= 5:
        print("❌ Avaliação deve estar entre 1 e 5.")
        return {"ok": False, "erro": "Avaliação deve estar entre 1 e 5."}

    try:
        with Session(engine) as session:
            aula = session.get(Aula, aula_id)
            if not aula:
                return {"ok": False, "erro": "Sessão não encontrada."}

            if aula.estado != ESTADO_CONFIRMADA:
                return {"ok": False, "erro": f"Só sessões confirmadas podem ser terminadas (estado actual: '{aula.estado}')."}

            if aula.is_autonomous:
                return {"ok": False, "erro": "Trabalho autónomo não pode ser terminado desta forma."}

            if aula.data_hora > datetime.utcnow():
                return {"ok": False, "erro": "A sessão ainda não começou."}

            estado_anterior = aula.estado
            nota = (
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] "
                f"Estado: '{estado_anterior}' → '{ESTADO_TERMINADA}'"
                f" | Avaliação: {avaliacao}/5"
            )
            if obs_termino:
                nota += f" | {obs_termino}"

            aula.estado = ESTADO_TERMINADA
            aula.avaliacao = avaliacao
            aula.obs_termino = obs_termino
            aula.observacoes = (
                f"{aula.observacoes}\n{nota}" if aula.observacoes else nota
            )
            aula.atualizado_em = datetime.utcnow()

            session.add(aula)
            session.commit()

        print(f"✅ Sessão #{aula_id} terminada (avaliação: {avaliacao}/5)")

        # Notificar coordenadores
        try:
            from services import notification_service, profile_service

            perfis = profile_service.listar_perfis()
            coordenadores_ids = [p["id"] for p in perfis if p.get("role") == "coordenador"]

            aula_info = obter_aula_por_id(aula_id)
            mentor_nome = aula_info["mentor_nome"] if aula_info else "Um mentor"

            for coord_id in coordenadores_ids:
                notification_service.criar_notificacao(
                    user_id=coord_id,
                    tipo="session_terminada",
                    titulo="Sessão Terminada",
                    mensagem=f"{mentor_nome} terminou a sessão com avaliação {avaliacao}/5.",
                    link="/horarios",
                    metadados={"aula_id": aula_id},
                )
        except Exception as e:
            print(f"⚠️ Erro ao enviar notificação: {e}")

        return {"ok": True}

    except Exception as e:
        print(f"❌ Erro ao terminar sessão: {e}")
        return {"ok": False, "erro": str(e)}


def obter_aula_por_id(aula_id):
    try:
        with Session(engine) as session:
            # outerjoin para suportar sessões autónomas sem turma_id
            statement = (
                select(Aula, Turma, Estabelecimento, Mentor, Projeto)
                .outerjoin(Turma, Aula.turma_id == Turma.id)
                .outerjoin(Estabelecimento, Turma.estabelecimento_id == Estabelecimento.id)
                .outerjoin(Mentor, Aula.mentor_id == Mentor.id)
                .outerjoin(Projeto, Aula.projeto_id == Projeto.id)
                .where(Aula.id == aula_id)
            )
            row = session.exec(statement).first()

        if not row:
            print(f"❌ Aula #{aula_id} não encontrada!")
            return None

        aula, turma, estabelecimento, mentor, projeto = row
        atv_nome, disc_nome = _resolver_atividade(aula.atividade_id)
        payload = {
            "id": aula.id,
            "tipo": aula.tipo,
            "data_hora": aula.data_hora,
            "duracao_minutos": aula.duracao_minutos,
            "estado": aula.estado,
            "local": aula.local,
            "tema": aula.tema,
            "objetivos": aula.objetivos,
            "observacoes": aula.observacoes,
            "criado_em": aula.criado_em,
            "atualizado_em": aula.atualizado_em,
            "turma_nome": turma.nome if turma else None,
            "turma_id": turma.id if turma else None,
            "mentor_nome": mentor.nome if mentor else None,
            "mentor_id": mentor.id if mentor else None,
            "mentor_user_id": str(mentor.user_id) if mentor and mentor.user_id else None,
            "estabelecimento_nome": estabelecimento.nome if estabelecimento else None,
            "estabelecimento_sigla": estabelecimento.sigla if estabelecimento else None,
            "projeto_nome": projeto.nome if projeto else None,
            "atividade_nome": atv_nome,
            "atividade_id": aula.atividade_id,
            "disciplina_nome": disc_nome,
            "equipamento_nome": None,
            "is_autonomous": aula.is_autonomous,
            "is_realized": aula.is_realized,
            "tipo_atividade": aula.tipo_atividade,
            "responsavel_user_id": aula.responsavel_user_id,
            "musica_id": aula.musica_id,
            "avaliacao": aula.avaliacao,
            "obs_termino": aula.obs_termino,
        }
        return AulaListItem.model_validate(payload).model_dump()

    except Exception as e:
        print(f"❌ Erro ao obter aula: {e}")
        return None


def listar_todas_aulas(limite=100):
    try:
        with Session(engine) as session:
            # outerjoin em Turma/Estabelecimento para suportar sessões autónomas (sem turma_id)
            statement = (
                select(Aula, Turma, Estabelecimento, Mentor)
                .outerjoin(Turma, Aula.turma_id == Turma.id)
                .outerjoin(Estabelecimento, Turma.estabelecimento_id == Estabelecimento.id)
                .outerjoin(Mentor, Aula.mentor_id == Mentor.id)
                .order_by(Aula.data_hora.desc())
                .limit(limite)
            )
            rows = session.exec(statement).all()

        # Resolver nomes de atividade/disciplina em bulk
        atividade_map = _resolver_atividades_bulk([a.atividade_id for a, *_ in rows])

        aulas: List[Dict[str, Any]] = []
        for aula, turma, estabelecimento, mentor in rows:
            atv_nome, disc_nome = atividade_map.get(aula.atividade_id, (None, None))
            payload = {
                "id": aula.id,
                "tipo": aula.tipo,
                "data_hora": aula.data_hora,
                "duracao_minutos": aula.duracao_minutos,
                "estado": aula.estado,
                "tema": aula.tema,
                "local": aula.local,
                "objetivos": aula.objetivos,
                "observacoes": aula.observacoes,
                "criado_em": aula.criado_em,
                "atualizado_em": aula.atualizado_em,
                "turma_nome": turma.nome if turma else None,
                "turma_id": turma.id if turma else None,
                "mentor_nome": mentor.nome if mentor else None,
                "mentor_id": mentor.id if mentor else None,
                "mentor_user_id": str(mentor.user_id) if mentor and mentor.user_id else None,
                "estabelecimento_nome": estabelecimento.nome if estabelecimento else None,
                "estabelecimento_sigla": estabelecimento.sigla if estabelecimento else None,
                "projeto_nome": None,
                "atividade_id": aula.atividade_id,
                "atividade_nome": atv_nome,
                "equipamento_nome": None,
                "disciplina_nome": disc_nome,
                "is_autonomous": aula.is_autonomous,
                "is_realized": aula.is_realized,
                "tipo_atividade": aula.tipo_atividade,
                "responsavel_user_id": aula.responsavel_user_id,
                "musica_id": aula.musica_id,
                "avaliacao": aula.avaliacao,
                "obs_termino": aula.obs_termino,
            }
            aulas.append(AulaListItem.model_validate(payload).model_dump())

        return aulas

    except Exception as e:
        print(f"❌ Erro ao listar aulas: {e}")
        return []


def atualizar_aula(aula_id, dados):
    if not aula_id or not dados:
        return False

    try:
        with Session(engine) as session:
            # ORM: carregar entidade por PK para aplicar patch de campos e persistir no commit.
            aula = session.get(Aula, aula_id)
            if not aula:
                return False

            mentor_id_para_notificar = aula.mentor_id
            should_notify_mentor_change = False

            if "data_hora" in dados and dados["data_hora"] is not None:
                nova_data_hora = _parse_data_hora(dados["data_hora"])
                if nova_data_hora != aula.data_hora and aula.estado in [
                    ESTADO_CONFIRMADA,
                    ESTADO_RECUSADA,
                ]:
                    aula.estado = ESTADO_PENDENTE
                    nota = (
                        f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Sistema: "
                        "Horário alterado. Estado reiniciado para 'pendente'."
                    )
                    aula.observacoes = f"{aula.observacoes}\n{nota}" if aula.observacoes else nota
                    should_notify_mentor_change = True
                aula.data_hora = nova_data_hora

            campos_permitidos = {
                "turma_id",
                "mentor_id",
                "projeto_id",
                "tipo",
                "duracao_minutos",
                "local",
                "tema",
                "objetivos",
                "observacoes",
                "atividade_id",
                "estado",
            }

            for campo, valor in dados.items():
                if campo in campos_permitidos and campo != "data_hora":
                    setattr(aula, campo, valor)

            aula.atualizado_em = datetime.utcnow()
            mentor_id_para_notificar = aula.mentor_id

            # ORM: flush/commit gera UPDATE com os atributos sujos do objeto aula.
            session.add(aula)
            session.commit()

        print(f"✅ Aula #{aula_id} atualizada com sucesso!")

        if should_notify_mentor_change and mentor_id_para_notificar:
            try:
                from services import notification_service, profile_service, turma_service

                email_mentor = turma_service.obter_email_mentor(mentor_id_para_notificar)
                if email_mentor:
                    profile_id = profile_service.obter_profile_id_por_email(email_mentor)
                    if profile_id:
                        notification_service.criar_notificacao(
                            user_id=profile_id,
                            tipo="session_updated",
                            titulo="Horário de Sessão Alterado",
                            mensagem=(
                                "O horário da sessão foi alterado. "
                                "Por favor confirme a nova hora."
                            ),
                            link="/horarios",
                            metadados={"aula_id": aula_id},
                        )
            except Exception as e:
                print(f"⚠️ Erro ao notificar mentor: {e}")

        return True

    except Exception as e:
        print(f"❌ Erro ao atualizar aula: {e}")
        return False


def apagar_aula(aula_id):
    try:
        with Session(engine) as session:
            # ORM: delete em entidade carregada vira DELETE FROM aulas WHERE id = ? no commit.
            aula = session.get(Aula, aula_id)
            if not aula:
                print(f"❌ Aula #{aula_id} não encontrada!")
                return False

            session.delete(aula)
            session.commit()

        print(f"✅ Aula #{aula_id} apagada com sucesso!")
        return True

    except Exception as e:
        print(f"❌ Erro ao apagar aula: {e}")
        return False
