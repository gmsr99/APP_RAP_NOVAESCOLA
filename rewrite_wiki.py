import re

with open("frontend/src/pages/Wiki.tsx", "r") as f:
    content = f.read()

# 1. Add Sheet imports
content = content.replace(
    "import {\n  Dialog,",
    "import {\n  Sheet,\n  SheetContent,\n  SheetDescription,\n  SheetHeader,\n  SheetTitle,\n  SheetFooter,\n} from '@/components/ui/sheet';\nimport {\n  Dialog,"
)

content = content.replace(
    "import { Book, Layers,",
    "import { ChevronRight, ArrowLeft, Book, Layers,"
)

# 2. Add selectedNode state
state_injection = """
  // State for Master-Detail Navigation
  type SelectedNode = 
    | null 
    | { type: 'estab'; id: number; data: WikiEstabelecimento }
    | { type: 'turma'; id: number; data: WikiTurma; estabId: number }
    | { type: 'disc'; id: number; data: TurmaDisciplina; turmaId: number };
  const [selectedNode, setSelectedNode] = useState<SelectedNode>(null);
"""
content = re.sub(
    r"(const \[showInfoCards, setShowInfoCards\] = useState\(false\);)",
    r"\1\n" + state_injection,
    content
)

# 3. Replace the entire return statement
new_return = """
  // Helper renderers for Master-Detail
  const renderMasterTree = () => {
    return (
      <div className="space-y-4">
        {/* Projeto Selector */}
        <div className="space-y-3 bg-card p-4 rounded-xl border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><Layers className="h-4 w-4 text-primary"/> Projeto</h3>
            {isCoordinator && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                setEditingProjeto(null); setProjetoForm({ nome: '', descricao: '' }); setIsProjetoDialogOpen(true);
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Select value={selectedProjetoId ? String(selectedProjetoId) : undefined} onValueChange={(v) => { setSelectedProjetoId(Number(v)); setSelectedNode(null); }}>
            <SelectTrigger><SelectValue placeholder="Selecionar projeto..." /></SelectTrigger>
            <SelectContent>
              {projetos.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedProjetoId && isCoordinator && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => {
                const p = projetos.find(x => x.id === selectedProjetoId);
                if (p) { setEditingProjeto(p); setProjetoForm({ nome: p.nome, descricao: p.descricao || '' }); setIsProjetoDialogOpen(true); }
              }}>Editar</Button>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => {
                setConfigForm({ requer_digitalizacao: selectedProjeto?.requer_digitalizacao ?? false, tem_pre_registos: selectedProjeto?.tem_pre_registos ?? false, codigo_projeto: selectedProjeto?.codigo_projeto ?? '', usar_template_proprio: selectedProjeto?.usar_template_proprio ?? false });
                setIsConfigModalOpen(true);
              }}>Configs</Button>
            </div>
          )}
        </div>

        {/* Hierarchy Tree */}
        <div className="bg-card rounded-xl border overflow-hidden flex flex-col max-h-[60vh]">
          <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Hierarquia</h3>
            {isCoordinator && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={openNewEstab}><Plus className="h-4 w-4"/></Button>
            )}
          </div>
          <div className="overflow-y-auto p-2 space-y-1">
            {!selectedProjetoId ? (
              <p className="text-xs text-muted-foreground text-center py-4">Seleciona um projeto acima.</p>
            ) : hierarquiaLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">A carregar...</p>
            ) : wikiHierarquia.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem estabelecimentos.</p>
            ) : (
              wikiHierarquia.map(estab => (
                <div key={estab.id} className="space-y-1">
                  <button 
                    onClick={() => setSelectedNode({ type: 'estab', id: estab.id, data: estab })}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-sm transition-colors ${selectedNode?.type === 'estab' && selectedNode.id === estab.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
                  >
                    <span className="flex items-center gap-2 truncate"><Building2 className="h-4 w-4 shrink-0"/> {estab.nome}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0"/>
                  </button>
                  {/* Render Turmas only if Estab is selected or partially selected */}
                  {(selectedNode?.type === 'estab' && selectedNode.id === estab.id) || (selectedNode?.type === 'turma' && selectedNode.estabId === estab.id) || (selectedNode?.type === 'disc' && wikiHierarquia.find(e=>e.id===estab.id)?.turmas.some(t=>t.id===selectedNode.turmaId)) ? (
                    <div className="pl-4 space-y-1 border-l-2 border-muted ml-4 mt-1">
                      {estab.turmas.map(turma => (
                        <div key={turma.id} className="space-y-1">
                          <button
                            onClick={() => setSelectedNode({ type: 'turma', id: turma.id, data: turma, estabId: estab.id })}
                            className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between text-sm transition-colors ${selectedNode?.type === 'turma' && selectedNode.id === turma.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
                          >
                            <span className="flex items-center gap-2 truncate"><Users className="h-3.5 w-3.5 shrink-0"/> {turma.nome}</span>
                            <ChevronRight className="h-3 w-3 opacity-50 shrink-0"/>
                          </button>
                          {/* Render Disciplinas */}
                          {((selectedNode?.type === 'turma' && selectedNode.id === turma.id) || (selectedNode?.type === 'disc' && selectedNode.turmaId === turma.id)) && (
                            <div className="pl-4 space-y-1 border-l-2 border-muted ml-4 mt-1">
                              {turma.disciplinas.map(disc => (
                                <button
                                  key={disc.id}
                                  onClick={() => setSelectedNode({ type: 'disc', id: disc.id, data: disc, turmaId: turma.id })}
                                  className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center text-sm transition-colors ${selectedNode?.type === 'disc' && selectedNode.id === disc.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}
                                >
                                  <span className="flex items-center gap-2 truncate"><Book className="h-3 w-3 shrink-0"/> {disc.nome}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderEstabDetail = (node: { type: 'estab', id: number, data: WikiEstabelecimento }) => {
    const estab = wikiHierarquia.find(e => e.id === node.id);
    if (!estab) return null;
    const contactos = contactosPorEstab[estab.id] || [];
    
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <span>{selectedProjeto?.nome}</span> <ChevronRight className="h-3 w-3"/>
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary"/> {estab.nome}</h2>
            {estab.sigla && <Badge variant="outline" className="mt-2">{estab.sigla}</Badge>}
          </div>
          {isCoordinator && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { const e = estabelecimentos.find(x => x.id === estab.id); if (e) openEditEstab(e); }}><Edit2 className="h-4 w-4 mr-2"/> Editar</Button>
            </div>
          )}
        </div>

        {/* Contactos */}
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Contactos</h3>
            {isCoordinator && <Button size="sm" variant="ghost" onClick={() => openNewContacto(estab.id)}><Plus className="h-4 w-4 mr-1"/> Adicionar</Button>}
          </div>
          {contactos.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sem contactos.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {contactos.map(c => {
                const href = contactoHref(c);
                return (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 group">
                    <div className="mt-0.5 bg-background p-1.5 rounded-md border shadow-sm">{contactoIcon(c.tipo)}</div>
                    <div className="min-w-0 flex-1">
                      {c.descricao && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.descricao}</p>}
                      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline truncate block">{c.valor}</a> : <span className="text-sm font-medium truncate block">{c.valor}</span>}
                    </div>
                    {isCoordinator && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditContacto(c)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Turmas Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Users className="h-5 w-5"/> Turmas ({estab.turmas.length})</h3>
            {isCoordinator && <Button size="sm" onClick={() => openNewTurma(estab.id)}><Plus className="h-4 w-4 mr-1"/> Nova Turma</Button>}
          </div>
          {estab.turmas.length === 0 ? (
            <div className="text-center py-12 bg-muted/10 border border-dashed rounded-xl"><p className="text-muted-foreground">Nenhuma turma registada.</p></div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {estab.turmas.map(turma => (
                <div key={turma.id} onClick={() => setSelectedNode({ type: 'turma', id: turma.id, data: turma, estabId: estab.id })} className="group cursor-pointer border rounded-xl p-4 bg-card hover:border-primary/50 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-lg">{turma.nome}</h4>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors"/>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{turma.disciplinas.length} disciplinas</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTurmaDetail = (node: { type: 'turma', id: number, data: WikiTurma, estabId: number }) => {
    const estab = wikiHierarquia.find(e => e.id === node.estabId);
    const turma = estab?.turmas.find(t => t.id === node.id);
    if (!estab || !turma) return null;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1 truncate">
              <span className="truncate">{estab.nome}</span> <ChevronRight className="h-3 w-3 shrink-0"/>
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary"/> Turma {turma.nome}</h2>
          </div>
          {isCoordinator && (
            <Button variant="outline" size="sm" onClick={() => openEditTurma(turma, estab.id)}><Edit2 className="h-4 w-4 mr-2"/> Gerir Turma & Alunos</Button>
          )}
        </div>

        {/* Disciplinas Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg flex items-center gap-2"><Book className="h-5 w-5"/> Disciplinas ({turma.disciplinas.length})</h3>
            {isCoordinator && <Button size="sm" onClick={() => openNewDisciplina(turma.id)}><Plus className="h-4 w-4 mr-1"/> Nova Disciplina</Button>}
          </div>
          {turma.disciplinas.length === 0 ? (
            <div className="text-center py-12 bg-muted/10 border border-dashed rounded-xl"><p className="text-muted-foreground">Nenhuma disciplina atribuída.</p></div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {turma.disciplinas.map(disc => (
                <div key={disc.id} onClick={() => setSelectedNode({ type: 'disc', id: disc.id, data: disc, turmaId: turma.id })} className="group cursor-pointer border rounded-xl p-5 bg-card hover:border-purple-500/50 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-lg text-purple-400">{disc.nome}</h4>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-purple-400 transition-colors"/>
                  </div>
                  {disc.descricao && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{disc.descricao}</p>}
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/20">{disc.atividades.length} Atividades</Badge>
                    {disc.musicas_previstas > 0 && <Badge variant="outline"><Music className="h-3 w-3 mr-1"/> {disc.musicas_previstas}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDiscDetail = (node: { type: 'disc', id: number, data: TurmaDisciplina, turmaId: number }) => {
    let estabName = '';
    let turmaName = '';
    let disc = null;
    for (const e of wikiHierarquia) {
      for (const t of e.turmas) {
        if (t.id === node.turmaId) {
          estabName = e.nome; turmaName = t.nome;
          disc = t.disciplinas.find(d => d.id === node.id);
        }
      }
    }
    if (!disc) return null;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 flex flex-col h-full">
        <div className="flex items-start justify-between border-b pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-xs sm:text-sm mb-1 truncate">
              <span className="truncate">{estabName}</span> <ChevronRight className="h-3 w-3 shrink-0"/>
              <span className="truncate">Turma {turmaName}</span> <ChevronRight className="h-3 w-3 shrink-0"/>
            </div>
            <h2 className="text-2xl font-bold flex items-center gap-2"><Book className="h-6 w-6 text-purple-400"/> {disc.nome}</h2>
            {disc.descricao && <p className="text-muted-foreground mt-2">{disc.descricao}</p>}
          </div>
          {isCoordinator && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditDisciplina(disc!)}><Edit2 className="h-4 w-4 md:mr-2"/><span className="hidden md:inline">Editar Disciplina</span></Button>
            </div>
          )}
        </div>

        {/* Atividades Table - takes remaining height */}
        <div className="flex-1 flex flex-col min-h-0 bg-card rounded-xl border overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-lg">Atividades ({disc.atividades.length})</h3>
            {isCoordinator && <Button size="sm" onClick={() => openNewAtividade(disc!.id)}><Plus className="h-4 w-4 mr-1"/> Adicionar Atividade</Button>}
          </div>
          <div className="overflow-auto p-0 flex-1">
            {disc.atividades.length === 0 ? (
               <div className="text-center py-16"><p className="text-muted-foreground">Sem atividades planeadas para esta disciplina.</p></div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 backdrop-blur-md">
                  <TableRow>
                    <TableHead className="w-[80px]">Cód.</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead className="text-center">Sessões</TableHead>
                    <TableHead className="text-center">H/Sess.</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="w-[150px]">Progresso</TableHead>
                    {isCoordinator && <TableHead className="w-[60px]"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disc.atividades.map((ativ) => {
                    const sessRealizadas = ativ.sessoes_realizadas ?? 0;
                    const sessPrevistas = ativ.sessoes_previstas || 0;
                    const progressPct = sessPrevistas > 0 ? Math.min(100, Math.round((sessRealizadas / sessPrevistas) * 100)) : 0;
                    return (
                      <TableRow key={ativ.uuid} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs font-semibold text-muted-foreground">{ativ.codigo || '—'}</TableCell>
                        <TableCell className="font-medium">{ativ.nome}</TableCell>
                        <TableCell className="text-center">{ativ.sessoes_previstas || '—'}</TableCell>
                        <TableCell className="text-center">{ativ.horas_por_sessao || '—'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {ativ.role ? <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{ativ.role}</Badge> : <span className="text-muted-foreground text-xs italic">livre</span>}
                            {ativ.is_autonomous && <Badge className="text-[10px] bg-blue-500 hover:bg-blue-600 uppercase">Autónomo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {sessRealizadas}/{sessPrevistas || '?'}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {ativ.horas_realizadas ?? 0}h</span>
                            </div>
                            {sessPrevistas > 0 && <Progress value={progressPct} className="h-1.5" />}
                          </div>
                        </TableCell>
                        {isCoordinator && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20 hover:text-primary" onClick={() => openEditAtividade(ativ)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-[1600px] mx-auto p-4 md:p-6 overflow-hidden">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-2">
            <Book className="h-8 w-8 text-primary" />
            Wiki / Hierarquia
          </h1>
          <p className="text-muted-foreground mt-1">
            Navega pelos projetos para gerir estabelecimentos, turmas e atividades.
          </p>
        </div>
      </div>

      {/* Responsive Split Layout */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-12 gap-6 min-h-0">
        
        {/* MASTER PANE (Tree) */}
        <div className={`col-span-12 md:col-span-4 lg:col-span-3 flex-col gap-4 overflow-y-auto pr-2 pb-8 ${selectedNode ? 'hidden md:flex' : 'flex'}`}>
          {renderMasterTree()}
        </div>

        {/* DETAIL PANE */}
        <div className={`col-span-12 md:col-span-8 lg:col-span-9 flex-col min-h-0 overflow-y-auto pb-8 ${!selectedNode ? 'hidden md:flex' : 'flex'}`}>
          {/* Mobile Back Button */}
          {selectedNode && (
            <div className="md:hidden mb-4 shrink-0">
              <Button variant="ghost" className="gap-2 -ml-3" onClick={() => setSelectedNode(null)}>
                <ArrowLeft className="h-4 w-4" /> Voltar à navegação
              </Button>
            </div>
          )}

          {!selectedNode ? (
            <div className="h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-muted-foreground bg-muted/5">
              <Layers className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Selecione um item na barra lateral</p>
              <p className="text-sm">Explore os estabelecimentos e turmas do projeto.</p>
            </div>
          ) : (
            <>
              {selectedNode.type === 'estab' && renderEstabDetail(selectedNode)}
              {selectedNode.type === 'turma' && renderTurmaDetail(selectedNode)}
              {selectedNode.type === 'disc' && renderDiscDetail(selectedNode)}
            </>
          )}
        </div>
      </div>

      {/* KEEP DIALOGS EXACTLY AS THEY WERE, JUST RENDER THEM HERE */}
      {/* DIALOG FOR PROJETOS */}
      <Sheet open={isProjetoDialogOpen} onOpenChange={setIsProjetoDialogOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingProjeto ? 'Editar Projeto' : 'Novo Projeto'}</SheetTitle>
            <SheetDescription>
              {editingProjeto ? 'Alterar dados do projeto.' : 'Criar um novo projeto.'}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4 mt-4">
            <div className="grid gap-2">
              <Label htmlFor="proj-nome">Nome</Label>
              <Input
                id="proj-nome"
                value={projetoForm.nome}
                onChange={(e) => setProjetoForm({ ...projetoForm, nome: e.target.value })}
                placeholder="Ex: PIS, Gulbenkian 70 anos"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proj-desc">Descrição</Label>
              <Input
                id="proj-desc"
                value={projetoForm.descricao}
                onChange={(e) => setProjetoForm({ ...projetoForm, descricao: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsProjetoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveProjetoMutation.mutate(projetoForm)} disabled={!projetoForm.nome}>
              <Save className="h-4 w-4 mr-2" />
              {editingProjeto ? 'Atualizar' : 'Criar'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Continue using Dialog for others to not break existing complex forms instantly. Let's just restore them. */}
      {/* DIALOG FOR ESTABELECIMENTOS */}
      <Dialog open={isEstabDialogOpen} onOpenChange={setIsEstabDialogOpen}>
        <DialogContent className="w-full max-w-lg max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEstab ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="inst-sigla">Sigla</Label>
              <Input id="inst-sigla" value={estabForm.sigla} onChange={(e) => setEstabForm({ ...estabForm, sigla: e.target.value })} placeholder="EX: EPL" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inst-nome">Nome</Label>
              <Input id="inst-nome" value={estabForm.nome} onChange={(e) => setEstabForm({ ...estabForm, nome: e.target.value })} placeholder="Nome completo" />
            </div>
            <div className="grid gap-2">
              <Label>Morada</Label>
              <AddressAutocomplete
                value={estabForm.morada}
                onSelect={(r) => setEstabForm({ ...estabForm, morada: r.display_name, latitude: r.lat, longitude: r.lon })}
                placeholder="Pesquisar morada..."
              />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingEstab ? (
              <div className="flex gap-2">
                {selectedProjetoId && (
                  <Button variant="outline" onClick={() => {
                    askConfirm(
                      'Desassociar estabelecimento?',
                      `"${editingEstab.nome}" será removido deste projeto, mas não apagado da base de dados.`,
                      () => desassocEstabMutation.mutate(editingEstab.id)
                    );
                  }}>
                    <Link2Off className="h-4 w-4 mr-2" /> Desassociar
                  </Button>
                )}
                <Button variant="destructive" onClick={() => {
                  askConfirm(
                    'Apagar estabelecimento?',
                    `"${editingEstab.nome}" será permanentemente apagado, incluindo as suas turmas.`,
                    () => deleteEstabMutation.mutate(editingEstab.id)
                  );
                }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Apagar
                </Button>
              </div>
            ) : <div />}
            <Button onClick={() => saveEstabMutation.mutate(estabForm)}>
              <Save className="h-4 w-4 mr-2" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR TURMAS */}
      <Sheet open={isTurmaDialogOpen} onOpenChange={setIsTurmaDialogOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTurma ? 'Editar Turma' : 'Nova Turma'}</SheetTitle>
            <SheetDescription>
              {editingTurma ? 'Alterar dados da turma e gerir alunos.' : 'Criar nova turma num estabelecimento.'}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4 mt-4">
            <div className="space-y-2">
              <Label>Estabelecimento</Label>
              <Select value={selectedEstabId} onValueChange={setSelectedEstabId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estabelecimento" />
                </SelectTrigger>
                <SelectContent>
                  {estabelecimentos.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id.toString()}>{inst.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="turma-name">Nome da Turma</Label>
              <Input id="turma-name" placeholder="Ex: 12.º B" value={newTurmaName} onChange={(e) => setNewTurmaName(e.target.value)} />
            </div>
            {/* Lista de Alunos */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Alunos</Label>
                <Button variant="outline" size="sm" type="button" onClick={() => setAlunosNomes(prev => [...prev, ''])}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {alunosNomes.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum aluno registado.</p>
              )}
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2">
                {alunosNomes.map((nome, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder={`Aluno ${i + 1}`} value={nome} onChange={e => {
                      const updated = [...alunosNomes];
                      updated[i] = e.target.value;
                      setAlunosNomes(updated);
                    }} className="text-sm" />
                    <Button variant="ghost" size="icon" type="button" onClick={() => setAlunosNomes(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <SheetFooter className="flex sm:justify-between w-full mt-6">
            {editingTurma ? (
              <Button variant="destructive" onClick={() => {
                askConfirm(
                  'Apagar turma?',
                  `A turma "${editingTurma.nome}" e todas as suas disciplinas e atividades serão permanentemente apagadas.`,
                  () => deleteTurmaMutation.mutate(editingTurma.id)
                );
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Apagar
              </Button>
            ) : <div />}
            <Button onClick={handleSaveTurma}>Gravar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* DIALOG FOR LOCAL DISCIPLINA */}
      <Dialog open={isDisciplinaDialogOpen} onOpenChange={setIsDisciplinaDialogOpen}>
        <DialogContent className="w-full max-w-2xl max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDisciplina ? 'Editar Disciplina' : 'Nova Disciplina'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nome da Disciplina</Label>
                <Input value={discForm.nome} onChange={(e) => setDiscForm({ ...discForm, nome: e.target.value })} placeholder="Ex: Clube de RAP" />
              </div>
              <div className="grid gap-2">
                <Label>Músicas Previstas</Label>
                <Input type="number" min={0} value={discForm.musicas_previstas} onChange={(e) => setDiscForm({ ...discForm, musicas_previstas: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={discForm.descricao}
                onChange={(e) => setDiscForm({ ...discForm, descricao: e.target.value })}
                placeholder="Breve descrição"
                className="resize-none"
                rows={2}
              />
            </div>
            {/* Batch atividades (só para nova disciplina) */}
            {!editingDisciplina && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Atividades (batch)</Label>
                  <Button variant="outline" size="sm" type="button" onClick={addBatchAtividade}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Atividade
                  </Button>
                </div>
                {batchAtividades.length === 0 && (
                  <p className="text-sm text-muted-foreground">Pode adicionar atividades agora ou mais tarde.</p>
                )}
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {batchAtividades.map((a, i) => (
                    <div key={i} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Atividade {i + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBatchAtividades(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input placeholder="Nome" value={a.nome} onChange={e => {
                          const up = [...batchAtividades]; up[i] = { ...up[i], nome: e.target.value }; setBatchAtividades(up);
                        }} />
                        <Select value={a.codigo || 'none'} onValueChange={v => { const up = [...batchAtividades]; up[i] = { ...up[i], codigo: v === 'none' ? '' : v }; setBatchAtividades(up); }}>
                          <SelectTrigger><SelectValue placeholder="Código" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Sem código —</SelectItem>
                            {CODIGOS_ATIVIDADE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                        <div>
                          <Label className="text-xs">Sessões</Label>
                          <Input type="number" min={0} value={a.sessoes_previstas} onChange={e => {
                            const up = [...batchAtividades]; up[i] = { ...up[i], sessoes_previstas: e.target.value }; setBatchAtividades(up);
                          }} />
                        </div>
                        <div>
                          <Label className="text-xs">H/Sessão</Label>
                          <Input type="number" min={0} step={0.5} value={a.horas_por_sessao} onChange={e => {
                            const up = [...batchAtividades]; up[i] = { ...up[i], horas_por_sessao: e.target.value }; setBatchAtividades(up);
                          }} />
                        </div>
                        <div>
                          <Label className="text-xs">Músicas</Label>
                          <Input type="number" min={0} value={a.musicas_previstas} onChange={e => {
                            const up = [...batchAtividades]; up[i] = { ...up[i], musicas_previstas: e.target.value }; setBatchAtividades(up);
                          }} />
                        </div>
                        <div className="md:col-span-4">
                          <Label className="text-xs">Associar a</Label>
                          <Select value={a.role || 'none'} onValueChange={v => {
                            const up = [...batchAtividades];
                            up[i] = { ...up[i], role: v === 'none' ? '' : v };
                            setBatchAtividades(up);
                          }}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="— Sem restrição —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Sem restrição —</SelectItem>
                              {ALL_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingDisciplina ? (
              <Button variant="destructive" onClick={() => {
                askConfirm(
                  'Apagar disciplina?',
                  `"${editingDisciplina.nome}" e todas as suas atividades serão permanentemente apagadas.`,
                  () => deleteDisciplinaMutation.mutate(editingDisciplina.id)
                );
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Apagar
              </Button>
            ) : <div />}
            <Button onClick={handleSaveDisciplina} disabled={!discForm.nome}>
              <Save className="h-4 w-4 mr-2" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR LOCAL ATIVIDADE */}
      <Dialog open={isAtividadeDialogOpen} onOpenChange={setIsAtividadeDialogOpen}>
        <DialogContent className="w-full max-w-2xl max-h-[95dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Código</Label>
              <Select value={ativForm.codigo || 'none'} onValueChange={(v) => setAtivForm({ ...ativForm, codigo: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar código" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem código —</SelectItem>
                  {CODIGOS_ATIVIDADE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Nome da Atividade</Label>
              <Input value={ativForm.nome} onChange={(e) => setAtivForm({ ...ativForm, nome: e.target.value })} placeholder="Nome descritivo" />
            </div>
            <div className="grid gap-2">
              <Label>Sessões Previstas</Label>
              <Input type="number" min={0} value={ativForm.sessoes_previstas} onChange={(e) => setAtivForm({ ...ativForm, sessoes_previstas: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Horas por Sessão</Label>
              <Input type="number" min={0} step={0.5} value={ativForm.horas_por_sessao} onChange={(e) => setAtivForm({ ...ativForm, horas_por_sessao: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Músicas Previstas</Label>
              <Input type="number" min={0} value={ativForm.musicas_previstas} onChange={(e) => setAtivForm({ ...ativForm, musicas_previstas: e.target.value })} />
            </div>
            <div className="md:col-span-2 grid gap-2">
              <Label>Associar a</Label>
              <Select value={ativForm.role || 'none'} onValueChange={(v) => setAtivForm({ ...ativForm, role: v === 'none' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="— Sem restrição —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem restrição —</SelectItem>
                  {ALL_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex items-center gap-3 rounded-md border p-3 bg-muted/30">
              <Checkbox
                id="ativ-autonomous"
                checked={ativForm.is_autonomous}
                onCheckedChange={(checked) => setAtivForm({ ...ativForm, is_autonomous: !!checked })}
              />
              <div>
                <Label htmlFor="ativ-autonomous" className="cursor-pointer font-medium">Trabalho Autónomo</Label>
                <p className="text-xs text-muted-foreground">Esta atividade aparece no separador "Trabalho Autónomo" em /Horários</p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingAtividade ? (
              <Button variant="destructive" onClick={() => {
                askConfirm(
                  'Apagar atividade?',
                  `"${editingAtividade.nome}" será permanentemente apagada.`,
                  () => deleteAtividadeMutation.mutate(editingAtividade.uuid)
                );
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Apagar
              </Button>
            ) : <div />}
            <Button onClick={handleSaveAtividade} disabled={!ativForm.nome}>
              <Save className="h-4 w-4 mr-2" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG FOR CONTACTOS */}
      <Dialog open={isContactoDialogOpen} onOpenChange={setIsContactoDialogOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContacto ? 'Editar Contacto' : 'Novo Contacto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={contactoForm.tipo} onValueChange={(v) => setContactoForm({ ...contactoForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="maps">Google Maps</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Valor</Label>
              <Input
                value={contactoForm.valor}
                onChange={(e) => setContactoForm({ ...contactoForm, valor: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={contactoForm.descricao}
                onChange={(e) => setContactoForm({ ...contactoForm, descricao: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between w-full">
            {editingContacto ? (
              <Button variant="destructive" onClick={() => {
                askConfirm('Apagar contacto?', 'Este contacto será permanentemente removido.', () => deleteContactoMutation.mutate(editingContacto.id));
              }}>
                <Trash2 className="h-4 w-4 mr-2" /> Apagar
              </Button>
            ) : <div />}
            <Button onClick={() => saveContactoMutation.mutate({ tipo: contactoForm.tipo, valor: contactoForm.valor, descricao: contactoForm.descricao || undefined })} disabled={!contactoForm.valor.trim()}>
              <Save className="h-4 w-4 mr-2" /> Gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SHARED CONFIRM DIALOG */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Config Modal */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Configurações do Projeto</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Requer Digitalização</Label>
                <p className="text-sm text-muted-foreground">Exigir scan dos sumários após aula.</p>
              </div>
              <Switch checked={configForm.requer_digitalizacao} onCheckedChange={(c) => setConfigForm(f => ({...f, requer_digitalizacao: c}))} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Pré-registos</Label>
                <p className="text-sm text-muted-foreground">Permitir pré-registo de mentores.</p>
              </div>
              <Switch checked={configForm.tem_pre_registos} onCheckedChange={(c) => setConfigForm(f => ({...f, tem_pre_registos: c}))} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Template Próprio</Label>
                <p className="text-sm text-muted-foreground">Usar folha PDF customizada.</p>
              </div>
              <Switch checked={configForm.usar_template_proprio} onCheckedChange={(c) => setConfigForm(f => ({...f, usar_template_proprio: c}))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveConfigMutation.mutate(configForm)} disabled={saveConfigMutation.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
"""

# Find the start of the return statement.
# The return statement starts with `return (` exactly at the top level of the component.
start_idx = content.find("return (")
if start_idx != -1:
    content = content[:start_idx] + new_return + "\n};\n\nexport default Wiki;\n"
else:
    print("Could not find 'return ('")

with open("frontend/src/pages/Wiki.tsx", "w") as f:
    f.write(content)

