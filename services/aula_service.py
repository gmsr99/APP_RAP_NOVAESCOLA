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
import logging

logger = logging.getLogger(__name__)

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



def _resolver_atividades_uuid_bulk(uuids):
    """Resolve multiple atividade_uuids → {uuid_str: (atividade_nome, disciplina_nome)}."""
    valid = [u for u in uuids if u is not None]
    if not valid:
        return {}
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        placeholders = ','.join(['%s'] * len(valid))
        # Convert UUID objects to strings for query
        str_uuids = [str(u) for u in valid]
        cur.execute(f"""
            SELECT ta.uuid::text, ta.nome, td.nome
            FROM turma_atividades ta
            JOIN turma_disciplinas td ON td.id = ta.turma_disciplina_id
            WHERE ta.uuid IN ({placeholders})
        """, str_uuids)
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
    atividade_uuid=None,
    is_autonomous=False,
    is_realized=False,
    tipo_atividade=None,
    responsavel_user_id=None,
    musica_id=None,
    sumario=None,
    codigo_sessao=None,
):
    if not is_autonomous and not turma_id:
        logger.error("Erro: turma_id e obrigatorio para aulas regulares!")
        return None

    if not data_hora:
        logger.error("Erro: data_hora e obrigatoria!")
        return None

    if not is_autonomous and tipo not in TIPOS_AULA:
        logger.warning("Tipo '%s' nao e padrao. Tipos validos: %s", tipo, TIPOS_AULA)

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
                atividade_uuid=atividade_uuid,
                is_autonomous=is_autonomous,
                is_realized=is_realized,
                tipo_atividade=tipo_atividade,
                responsavel_user_id=responsavel_user_id,
                musica_id=musica_id,
                sumario=sumario,
                codigo_sessao=codigo_sessao,
            )
            session.add(nova_aula)
            session.commit()
            session.refresh(nova_aula)

        logger.info("Aula #%s criada com sucesso!", nova_aula.id)

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
                logger.warning("Erro ao criar notificacao: %s", e)

        return _to_aula_read_dict(nova_aula)

    except Exception as e:
        logger.error("Erro ao criar aula: %s", e)
        return None


def criar_aulas_recorrentes(
    data_hora,
    duracao_minutos,
    tipo_atividade,
    responsavel_user_id,
    observacoes,
    semanas,
    tema=None,
    projeto_id=None,
    turma_id=None,
    mentor_id=None,
    local=None,
    atividade_uuid=None,
    is_autonomous=True,
    tipo="trabalho_autonomo",
    sumario=None,
    codigo_sessao=None,
):
    """Cria N sessões com intervalo semanal."""
    from datetime import timedelta

    data_hora_dt = _parse_data_hora(data_hora)
    resultados = []
    
    # helper para iterar o N. de Sessão caso seja um número (ex: "1" vira "1", "2", "3")
    try:
        tema_is_num = tema and str(tema).isdigit()
    except Exception:
        tema_is_num = False
        
    for i in range(semanas):
        data = data_hora_dt + timedelta(weeks=i)
        
        tema_sessao = tema
        if tema_is_num:
            tema_sessao = str(int(tema) + i)
            
        resultado = criar_aula(
            turma_id=turma_id,
            data_hora=data,
            tipo=tipo,
            duracao_minutos=duracao_minutos,
            mentor_id=mentor_id,
            local=local,
            tema=tema_sessao,
            projeto_id=projeto_id,
            observacoes=observacoes,
            atividade_uuid=atividade_uuid,
            is_autonomous=is_autonomous,
            tipo_atividade=tipo_atividade,
            responsavel_user_id=responsavel_user_id,
            sumario=sumario,
            codigo_sessao=codigo_sessao,
        )
        if resultado:
            resultados.append(resultado)
    logger.info("%s sessoes recorrentes criadas.", len(resultados))
    return resultados


def listar_aulas_por_estado(estado, limite=50):
    if estado not in ESTADOS_VALIDOS:
        logger.warning("Estado '%s' pode nao ser valido. Estados validos: %s", estado, ESTADOS_VALIDOS)

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

        uuid_map = _resolver_atividades_uuid_bulk([a.atividade_uuid for a, *_ in rows])

        aulas: List[Dict[str, Any]] = []
        for aula, turma, estabelecimento, mentor in rows:
            uuid_str = str(aula.atividade_uuid) if aula.atividade_uuid else None
            atv_nome, disc_nome = uuid_map.get(uuid_str, (None, None)) if uuid_str else (None, None)
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
                "atividade_uuid": uuid_str,
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

        logger.info("%s aula(s) encontrada(s) com estado '%s'", len(aulas), estado)
        return aulas

    except Exception as e:
        logger.error("Erro ao listar aulas: %s", e)
        return []


def atribuir_mentor(aula_id, mentor_id):
    if not aula_id or not mentor_id:
        logger.error("Erro: aula_id e mentor_id sao obrigatorios!")
        return False

    try:
        with Session(engine) as session:
            # ORM: session.get traduz-se num SELECT ... WHERE id = ? LIMIT 1.
            aula = session.get(Aula, aula_id)
            if not aula:
                logger.error("Erro: Aula #%s nao encontrada!", aula_id)
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

        logger.info("Mentor '%s' atribuido a aula #%s", mentor_nome, aula_id)

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
            logger.warning("Erro ao enviar notificacao: %s", e)

        return True

    except Exception as e:
        logger.error("Erro ao atribuir mentor: %s", e)
        return False


def mudar_estado_aula(aula_id, novo_estado):
    if novo_estado not in ESTADOS_VALIDOS:
        logger.error("Erro: Estado '%s' nao e valido! Estados validos: %s", novo_estado, ESTADOS_VALIDOS)
        return False

    try:
        with Session(engine) as session:
            # ORM: session.get carrega a aula e a alteração do atributo estado vira UPDATE no commit.
            aula = session.get(Aula, aula_id)
            if not aula:
                logger.error("Erro: Aula #%s nao encontrada!", aula_id)
                return False

            estado_anterior = aula.estado

            aula.estado = novo_estado
            aula.atualizado_em = datetime.utcnow()

            session.add(aula)
            session.commit()

        logger.info("Estado da aula #%s atualizado: '%s' -> '%s'", aula_id, estado_anterior, novo_estado)

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
                logger.warning("Erro ao enviar notificacao ao coordenador: %s", e)

        return True

    except Exception as e:
        logger.error("Erro ao mudar estado: %s", e)
        return False


def terminar_aula(aula_id, avaliacao, obs_termino=None):
    """Marca uma sessão presencial confirmada como terminada, com avaliação."""
    if not 1 <= avaliacao <= 5:
        logger.error("Avaliacao deve estar entre 1 e 5.")
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

            aula.estado = ESTADO_TERMINADA
            aula.avaliacao = avaliacao
            aula.obs_termino = obs_termino
            aula.atualizado_em = datetime.utcnow()

            session.add(aula)
            session.commit()

        logger.info("Sessao #%s terminada (avaliacao: %s/5)", aula_id, avaliacao)

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
            logger.warning("Erro ao enviar notificacao: %s", e)

        # Notificar mentor para indicar onde ficou o equipamento
        try:
            from services import equipment_service
            mentor_uid = aula_info.get("mentor_user_id") if aula_info else None
            if mentor_uid:
                equipment_service.notificar_localizacao_pendente(aula_id, mentor_uid)
        except Exception as e:
            logger.warning("Erro ao notificar localizacao de equipamento: %s", e)

        return {"ok": True}

    except Exception as e:
        logger.error("Erro ao terminar sessao: %s", e)
        return {"ok": False, "erro": str(e)}


def realizar_trabalho_autonomo(aula_id):
    """Marca um trabalho autónomo como realizado (is_realized = True)."""
    try:
        with Session(engine) as session:
            aula = session.get(Aula, aula_id)
            if not aula:
                return {"ok": False, "erro": "Sessão não encontrada."}

            if not aula.is_autonomous:
                return {"ok": False, "erro": "Esta sessão não é trabalho autónomo."}

            if aula.is_realized:
                return {"ok": False, "erro": "Este trabalho já foi marcado como realizado."}

            nota = (
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] "
                f"Trabalho Autónomo marcado como Realizado"
            )

            aula.is_realized = True
            aula.observacoes = (
                f"{aula.observacoes}\n{nota}" if aula.observacoes else nota
            )
            aula.atualizado_em = datetime.utcnow()

            session.add(aula)
            session.commit()

        logger.info("Trabalho Autonomo #%s marcado como realizado", aula_id)

        # Notificar coordenadores
        try:
            from services import notification_service, profile_service

            perfis = profile_service.listar_perfis()
            coordenadores_ids = [p["id"] for p in perfis if p.get("role") == "coordenador"]

            aula_info = obter_aula_por_id(aula_id)
            responsavel = aula_info.get("responsavel_user_id") if aula_info else None
            # Get responsavel name from profiles
            resp_nome = "Um membro"
            if responsavel:
                for p in perfis:
                    if p.get("id") == responsavel:
                        resp_nome = p.get("nome", "Um membro")
                        break

            for coord_id in coordenadores_ids:
                notification_service.criar_notificacao(
                    user_id=coord_id,
                    tipo="session_realizada",
                    titulo="Trabalho Autónomo Realizado",
                    mensagem=f"{resp_nome} marcou um trabalho autónomo como realizado.",
                    link="/horarios",
                    metadados={"aula_id": aula_id},
                )
        except Exception as e:
            logger.warning("Erro ao enviar notificacao: %s", e)

        return {"ok": True}

    except Exception as e:
        logger.error("Erro ao realizar trabalho autonomo: %s", e)
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
            logger.error("Aula #%s nao encontrada!", aula_id)
            return None

        aula, turma, estabelecimento, mentor, projeto = row
        uuid_str = str(aula.atividade_uuid) if aula.atividade_uuid else None
        if uuid_str:
            uuid_map = _resolver_atividades_uuid_bulk([aula.atividade_uuid])
            atv_nome, disc_nome = uuid_map.get(uuid_str, (None, None))
        else:
            atv_nome, disc_nome = None, None
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
            "atividade_uuid": uuid_str,
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

        uuid_map = _resolver_atividades_uuid_bulk([a.atividade_uuid for a, *_ in rows])

        aulas: List[Dict[str, Any]] = []
        for aula, turma, estabelecimento, mentor in rows:
            uuid_str = str(aula.atividade_uuid) if aula.atividade_uuid else None
            atv_nome, disc_nome = uuid_map.get(uuid_str, (None, None)) if uuid_str else (None, None)
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
                "atividade_uuid": uuid_str,
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
                "sumario",
                "codigo_sessao",
                "atividade_uuid",
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


def listar_horas_equipa(projeto_id=None):
    """Agrega horas por colaborador, separando sessões-aula de trabalho autónomo."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        projeto_filter = ""
        params = []
        if projeto_id:
            projeto_filter = "AND (a.projeto_id = %s OR (a.projeto_id IS NULL AND t.estabelecimento_id IN (SELECT estabelecimento_id FROM projeto_estabelecimentos WHERE projeto_id = %s)))"
            params.extend([projeto_id, projeto_id])

        cur.execute(f"""
            SELECT
                p.id as user_id,
                p.full_name as nome,
                COALESCE(SUM(a.duracao_minutos) FILTER (WHERE a.is_autonomous = FALSE), 0) as minutos_aulas,
                COALESCE(SUM(a.duracao_minutos) FILTER (WHERE a.is_autonomous = TRUE), 0) as minutos_autonomo,
                COALESCE(COUNT(*) FILTER (WHERE a.is_autonomous = FALSE), 0) as sessoes_aulas,
                COALESCE(COUNT(*) FILTER (WHERE a.is_autonomous = TRUE), 0) as sessoes_autonomo
            FROM profiles p
            JOIN mentores m ON m.user_id = p.id
            JOIN aulas a ON (
                (a.is_autonomous = FALSE AND a.mentor_id = m.id AND a.estado = 'terminada')
                OR
                (a.is_autonomous = TRUE AND a.responsavel_user_id = p.id::text AND a.is_realized = TRUE)
            )
            LEFT JOIN turmas t ON t.id = a.turma_id
            WHERE 1=1 {projeto_filter}
            GROUP BY p.id, p.full_name
            ORDER BY (SUM(a.duracao_minutos)) DESC
        """, params)

        rows = cur.fetchall()
        return [{
            'user_id': str(row[0]),
            'nome': row[1],
            'horas_aulas': round(row[2] / 60.0, 1),
            'horas_autonomo': round(row[3] / 60.0, 1),
            'sessoes_aulas': row[4],
            'sessoes_autonomo': row[5],
        } for row in rows]
    except Exception as e:
        print(f"❌ Erro ao listar horas equipa: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def contar_sessoes_user(user_id):
    """Conta sessões concluídas de um user (aulas terminadas como mentor + autónomas realizadas)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                COALESCE(COUNT(*) FILTER (WHERE a.is_autonomous = FALSE), 0) as sessoes_aulas,
                COALESCE(COUNT(*) FILTER (WHERE a.is_autonomous = TRUE), 0) as sessoes_autonomo
            FROM aulas a
            LEFT JOIN mentores m ON m.id = a.mentor_id
            WHERE (
                (a.is_autonomous = FALSE AND m.user_id = %s AND a.estado = 'terminada')
                OR
                (a.is_autonomous = TRUE AND a.responsavel_user_id = %s AND a.is_realized = TRUE)
            )
        """, [user_id, user_id])
        row = cur.fetchone()
        return {
            'sessoes_aulas': row[0] if row else 0,
            'sessoes_autonomo': row[1] if row else 0,
            'total': (row[0] + row[1]) if row else 0,
        }
    except Exception as e:
        print(f"❌ Erro ao contar sessões user: {e}")
        return {'sessoes_aulas': 0, 'sessoes_autonomo': 0, 'total': 0}
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def obter_proximo_numero_sessao(
    atividade_uuid: str = None,
    turma_id: int = None,
    projeto_id: int = None,
    is_autonomous: bool = False,
    responsavel_user_id: str = None,
) -> int:
    """Retorna o próximo número de sessão (COUNT + 1) para a atividade dada.
    Se atividade_uuid for fornecido, conta todas as aulas para esse UUID (critério preferido).
    Caso contrário usa o fallback por turma/projeto (legado).
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if atividade_uuid:
            # Critério principal: contar sessões por atividade UUID
            cur.execute(
                "SELECT COUNT(*) FROM aulas WHERE atividade_uuid = %s",
                (atividade_uuid,)
            )
            row = cur.fetchone()
            return (row[0] if row else 0) + 1

        # Fallback legado (sem atividade selecionada)
        if is_autonomous:
            conditions = ["a.is_autonomous = TRUE", "a.tema ~ '^[0-9]+$'"]
            params = []
            if responsavel_user_id:
                conditions.append("a.responsavel_user_id = %s")
                params.append(responsavel_user_id)
            if projeto_id:
                conditions.append("a.projeto_id = %s")
                params.append(projeto_id)
        else:
            conditions = ["a.is_autonomous = FALSE", "a.tema ~ '^[0-9]+$'"]
            params = []
            if turma_id:
                conditions.append("a.turma_id = %s")
                params.append(turma_id)
            if projeto_id:
                conditions.append("a.projeto_id = %s")
                params.append(projeto_id)

        where = " AND ".join(conditions)
        cur.execute(f"SELECT COALESCE(MAX(CAST(a.tema AS INTEGER)), 0) FROM aulas a WHERE {where}", params)
        row = cur.fetchone()
        return (row[0] if row else 0) + 1
    except Exception as e:
        print(f"❌ Erro ao obter próximo número de sessão: {e}")
        return 1
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def listar_feedback_sessoes(projeto_id=None):
    """Lista avaliações e observações de sessões terminadas, com info de turma/mentor/disciplina."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        conditions = ["a.estado = 'terminada'", "a.is_autonomous = FALSE", "a.avaliacao IS NOT NULL"]
        params = []

        if projeto_id:
            conditions.append("""(
                a.projeto_id = %s
                OR (a.projeto_id IS NULL AND t.estabelecimento_id IN (
                    SELECT estabelecimento_id FROM projeto_estabelecimentos WHERE projeto_id = %s
                ))
            )""")
            params.extend([projeto_id, projeto_id])

        query = f"""
            SELECT
                a.id, a.avaliacao, a.obs_termino, a.data_hora, a.duracao_minutos,
                t.id as turma_id, t.nome as turma_nome,
                e.id as estab_id, e.nome as estab_nome,
                p.full_name as mentor_nome, m.user_id as mentor_user_id,
                td.id as disciplina_id,
                td.nome as disciplina_nome
            FROM aulas a
            LEFT JOIN turmas t ON t.id = a.turma_id
            LEFT JOIN estabelecimentos e ON e.id = t.estabelecimento_id
            LEFT JOIN mentores m ON m.id = a.mentor_id
            LEFT JOIN profiles p ON p.id = m.user_id
            LEFT JOIN turma_atividades ta ON ta.uuid = a.atividade_uuid
            LEFT JOIN turma_disciplinas td ON td.id = ta.turma_disciplina_id
            WHERE {" AND ".join(conditions)}
            ORDER BY a.data_hora DESC
        """

        cur.execute(query, params)
        rows = cur.fetchall()

        resultado = []
        for row in rows:
            resultado.append({
                'id': row[0],
                'avaliacao': row[1],
                'obs_termino': row[2],
                'data_hora': row[3].isoformat() if row[3] else None,
                'duracao_minutos': row[4],
                'turma_id': row[5],
                'turma_nome': row[6],
                'estab_id': row[7],
                'estab_nome': row[8],
                'mentor_nome': row[9],
                'mentor_user_id': str(row[10]) if row[10] else None,
                'disciplina_id': row[11],
                'disciplina_nome': row[12],
            })

        return resultado
    except Exception as e:
        print(f"❌ Erro ao listar feedback de sessões: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


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
