from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


class Projeto(SQLModel, table=True):
    __tablename__ = "projetos"

    id: Optional[int] = Field(default=None, primary_key=True)
    nome: str

    aulas: List["Aula"] = Relationship(back_populates="projeto")


class Estabelecimento(SQLModel, table=True):
    __tablename__ = "estabelecimentos"

    id: Optional[int] = Field(default=None, primary_key=True)
    nome: str
    sigla: Optional[str] = None

    turmas: List["Turma"] = Relationship(back_populates="estabelecimento")


class Turma(SQLModel, table=True):
    __tablename__ = "turmas"

    id: Optional[int] = Field(default=None, primary_key=True)
    nome: str
    estabelecimento_id: int = Field(foreign_key="estabelecimentos.id")

    estabelecimento: Optional[Estabelecimento] = Relationship(back_populates="turmas")
    aulas: List["Aula"] = Relationship(back_populates="turma")
    musicas: List["Musica"] = Relationship(back_populates="turma")


class Mentor(SQLModel, table=True):
    __tablename__ = "mentores"

    id: Optional[int] = Field(default=None, primary_key=True)
    nome: str
    email: Optional[str] = None
    user_id: Optional[str] = None

    aulas: List["Aula"] = Relationship(back_populates="mentor")


class Aula(SQLModel, table=True):
    __tablename__ = "aulas"

    id: Optional[int] = Field(default=None, primary_key=True)
    projeto_id: Optional[int] = Field(default=None, foreign_key="projetos.id")
    turma_id: Optional[int] = Field(default=None, foreign_key="turmas.id")
    mentor_id: Optional[int] = Field(default=None, foreign_key="mentores.id")
    tipo: str = "pratica_escrita"
    data_hora: datetime
    duracao_minutos: int = 90
    estado: str = "rascunho"
    local: Optional[str] = None
    tema: Optional[str] = None
    objetivos: Optional[str] = None
    observacoes: Optional[str] = None
    atividade_id: Optional[int] = None

    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    # Campos para Trabalho Autónomo (Fase 1)
    is_autonomous: bool = Field(default=False)
    is_realized: bool = Field(default=False)
    tipo_atividade: Optional[str] = None
    responsavel_user_id: Optional[str] = None
    musica_id: Optional[int] = None
    # Campos para estado "Terminada"
    avaliacao: Optional[int] = None
    obs_termino: Optional[str] = None

    turma: Optional[Turma] = Relationship(back_populates="aulas")
    mentor: Optional[Mentor] = Relationship(back_populates="aulas")
    projeto: Optional[Projeto] = Relationship(back_populates="aulas")


class Musica(SQLModel, table=True):
    __tablename__ = "musicas"

    id: Optional[int] = Field(default=None, primary_key=True)
    titulo: str
    estado: str = "gravação"
    turma_id: Optional[int] = Field(default=None, foreign_key="turmas.id")
    disciplina: Optional[str] = None
    arquivado: bool = False
    criado_em: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    responsavel_id: Optional[str] = None
    criador_id: Optional[str] = None
    feedback: Optional[str] = None
    link_demo: Optional[str] = None
    misturado_por_id: Optional[str] = None
    revisto_por_id: Optional[str] = None
    finalizado_por_id: Optional[str] = None

    turma: Optional[Turma] = Relationship(back_populates="musicas")


class AulaCreate(SQLModel):
    turma_id: Optional[int] = None
    data_hora: datetime
    duracao_minutos: int = 90
    mentor_id: Optional[int] = None
    local: Optional[str] = None
    tema: Optional[str] = None
    observacoes: Optional[str] = None
    tipo: str = "pratica_escrita"
    atividade_id: Optional[int] = None

    objetivos: Optional[str] = None
    projeto_id: Optional[int] = None
    is_autonomous: bool = False
    is_realized: bool = False
    tipo_atividade: Optional[str] = None
    responsavel_user_id: Optional[str] = None
    musica_id: Optional[int] = None


class AulaUpdate(SQLModel):
    turma_id: Optional[int] = None
    mentor_id: Optional[int] = None
    data_hora: Optional[datetime] = None
    duracao_minutos: Optional[int] = None
    local: Optional[str] = None
    tema: Optional[str] = None
    observacoes: Optional[str] = None
    tipo: Optional[str] = None
    estado: Optional[str] = None
    atividade_id: Optional[int] = None

    objetivos: Optional[str] = None
    projeto_id: Optional[int] = None
    is_autonomous: Optional[bool] = None
    is_realized: Optional[bool] = None
    tipo_atividade: Optional[str] = None
    responsavel_user_id: Optional[str] = None
    musica_id: Optional[int] = None


class AulaRead(SQLModel):
    id: int
    turma_id: Optional[int] = None
    mentor_id: Optional[int] = None
    projeto_id: Optional[int] = None
    tipo: str
    data_hora: datetime
    duracao_minutos: int
    estado: str
    local: Optional[str] = None
    tema: Optional[str] = None
    objetivos: Optional[str] = None
    observacoes: Optional[str] = None
    atividade_id: Optional[int] = None

    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    is_autonomous: bool = False
    is_realized: bool = False
    tipo_atividade: Optional[str] = None
    responsavel_user_id: Optional[str] = None
    musica_id: Optional[int] = None
    avaliacao: Optional[int] = None
    obs_termino: Optional[str] = None


class AulaListItem(SQLModel):
    id: int
    tipo: str
    data_hora: datetime
    duracao_minutos: int
    estado: str
    tema: Optional[str] = None
    local: Optional[str] = None
    objetivos: Optional[str] = None
    observacoes: Optional[str] = None
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    turma_id: Optional[int] = None
    turma_nome: Optional[str] = None
    mentor_id: Optional[int] = None
    mentor_nome: Optional[str] = None
    mentor_user_id: Optional[str] = None
    estabelecimento_nome: Optional[str] = None
    estabelecimento_sigla: Optional[str] = None
    projeto_nome: Optional[str] = None
    atividade_id: Optional[int] = None
    atividade_nome: Optional[str] = None
    disciplina_nome: Optional[str] = None

    equipamento_nome: Optional[str] = None
    is_autonomous: bool = False
    is_realized: bool = False
    tipo_atividade: Optional[str] = None
    responsavel_user_id: Optional[str] = None
    musica_id: Optional[int] = None
    avaliacao: Optional[int] = None
    obs_termino: Optional[str] = None
