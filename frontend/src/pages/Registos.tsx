import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ClipboardList,
  Check,
  Calendar,
  MapPin,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Eye
} from 'lucide-react';
import { sessions, sessionRecords } from '@/data/mockData';
import { useProfile } from '@/contexts/ProfileContext';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Session } from '@/types';

// Component for the activity registration document preview/form
const ActivityDocumentForm = ({ 
  session, 
  observations,
  onDownload 
}: { 
  session: Session;
  observations: string;
  onDownload: () => void;
}) => {
  const [objectives, setObjectives] = useState('');
  const [activitySummary, setActivitySummary] = useState(observations);
  
  // Pre-filled data from the session
  const preFilledData = {
    designacao: 'RAP Nova Escola',
    codigoProjeto: 'CENTRO2030-FSE+0232800',
    atividade: `Sessão ${session.turma}`,
    numeroSessao: session.id,
    data: format(session.date, "dd/MM/yyyy", { locale: pt }),
    local: `${session.institution} - ${session.location}`,
    horarioInicio: session.startTime,
    horarioFim: session.endTime,
    tecnicos: session.mentor.name,
  };

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-lg p-4 bg-card">
        {/* Document Header */}
        <div className="text-center mb-6">
          <h3 className="font-display font-bold text-lg">REGISTO DE ATIVIDADE</h3>
          <p className="text-sm text-muted-foreground">RAP Nova Escola</p>
        </div>
        
        {/* Pre-filled Fields */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Designação do Projeto</Label>
            <Input 
              value={preFilledData.designacao} 
              readOnly 
              className="bg-secondary/30 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Cód. CENTRO2030-FSE+</Label>
            <Input 
              value={preFilledData.codigoProjeto} 
              readOnly 
              className="bg-secondary/30 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Atividade</Label>
            <Input 
              value={preFilledData.atividade} 
              readOnly 
              className="bg-secondary/30 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nº Sessão</Label>
            <Input 
              value={preFilledData.numeroSessao} 
              readOnly 
              className="bg-secondary/30 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Input 
              value={preFilledData.data} 
              readOnly 
              className="bg-secondary/30 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Local</Label>
            <Input 
              value={preFilledData.local} 
              readOnly 
              className="bg-secondary/30 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Horário</Label>
            <Input 
              value={`Das ${preFilledData.horarioInicio} às ${preFilledData.horarioFim}`} 
              readOnly 
              className="bg-secondary/30 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Técnico(s)/a(s)</Label>
            <Input 
              value={preFilledData.tecnicos} 
              readOnly 
              className="bg-secondary/30 text-sm"
            />
          </div>
        </div>
        
        {/* Editable Fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="objectives" className="font-medium">
              Objetivos Gerais
            </Label>
            <Textarea
              id="objectives"
              placeholder="Descreve os objetivos da sessão..."
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="summary" className="font-medium">
              Resumo da atividade desenvolvida
            </Label>
            <Textarea
              id="summary"
              placeholder="Descreve o que foi desenvolvido durante a sessão..."
              value={activitySummary}
              onChange={(e) => setActivitySummary(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onDownload}>
          <Eye className="h-4 w-4 mr-2" />
          Ver Template Original
        </Button>
        <Button className="flex-1" onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />
          Exportar Documento
        </Button>
      </div>
    </div>
  );
};

const Registos = () => {
  const { profile } = useProfile();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [completed, setCompleted] = useState(true);
  const [exceptions, setExceptions] = useState('');
  const [observations, setObservations] = useState('');
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

  // Get sessions that can be registered (confirmed and in the past or today)
  const registrableSessions = sessions.filter(s => 
    s.status === 'confirmado' && 
    new Date(s.date) <= new Date()
  );

  // Check if session already has a record
  const hasRecord = (sessionId: string) => 
    sessionRecords.some(r => r.sessionId === sessionId);

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  const handleSubmit = () => {
    console.log('Submitting record:', {
      sessionId: selectedSession,
      completed,
      exceptions,
      observations,
    });
    setSelectedSession(null);
    setCompleted(true);
    setExceptions('');
    setObservations('');
  };

  const handleDownloadTemplate = () => {
    // Open the template PDF in a new tab
    window.open('/templates/registo-atividade-template.pdf', '_blank');
  };

  const handleOpenDocumentForm = () => {
    if (selectedSessionData) {
      setShowDocumentDialog(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">Registos de Sessão</h1>
        <p className="text-muted-foreground mt-1">
          Regista o que aconteceu em cada sessão.
        </p>
      </div>

      {/* Quick Register */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Registar sessão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Seleciona a sessão a registar</Label>
              <Select 
                value={selectedSession || ''} 
                onValueChange={setSelectedSession}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolhe uma sessão..." />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {registrableSessions.map(session => (
                    <SelectItem 
                      key={session.id} 
                      value={session.id}
                      disabled={hasRecord(session.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span>
                          {format(session.date, "d MMM", { locale: pt })} - {session.startTime}
                        </span>
                        <span className="text-muted-foreground">•</span>
                        <span>{session.institution}</span>
                        {hasRecord(session.id) && (
                          <Badge variant="secondary" className="ml-2">Registado</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedSessionData && !hasRecord(selectedSessionData.id) && (
              <div className="space-y-4 p-4 rounded-lg bg-card border border-border">
                {/* Session Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(selectedSessionData.date, "d 'de' MMMM", { locale: pt })}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {selectedSessionData.startTime} - {selectedSessionData.endTime}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {selectedSessionData.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {selectedSessionData.turma}
                  </div>
                </div>
                
                {/* Form */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>A sessão realizou-se?</Label>
                      <p className="text-sm text-muted-foreground">
                        Indica se a sessão decorreu como planeado
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-sm',
                        !completed ? 'text-destructive font-medium' : 'text-muted-foreground'
                      )}>
                        Não
                      </span>
                      <Switch 
                        checked={completed} 
                        onCheckedChange={setCompleted}
                      />
                      <span className={cn(
                        'text-sm',
                        completed ? 'text-success font-medium' : 'text-muted-foreground'
                      )}>
                        Sim
                      </span>
                    </div>
                  </div>
                  
                  {!completed && (
                    <div className="space-y-2">
                      <Label htmlFor="exceptions">
                        O que aconteceu? <span className="text-destructive">*</span>
                      </Label>
                      <Textarea 
                        id="exceptions"
                        placeholder="Ex: Sessão cancelada por falta de alunos..."
                        value={exceptions}
                        onChange={(e) => setExceptions(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="observations">
                      Observações pedagógicas <span className="text-muted-foreground">(opcional)</span>
                    </Label>
                    <Textarea 
                      id="observations"
                      placeholder="Notas sobre a sessão, progressos dos alunos, etc..."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                    />
                  </div>

                  {/* Document Attachment Section */}
                  <div className="p-4 rounded-lg bg-secondary/20 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Registo de Atividade</p>
                          <p className="text-xs text-muted-foreground">
                            Documento oficial com campos pré-preenchidos
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleOpenDocumentForm}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Pré-visualizar
                      </Button>
                    </div>
                  </div>
                  
                  <Button onClick={handleSubmit} className="w-full">
                    <Check className="h-4 w-4 mr-2" />
                    Submeter Registo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {profile === 'coordenador' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Registos</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionRecords.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Ainda não existem registos.
              </p>
            ) : (
              <div className="space-y-3">
                {sessionRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'p-2 rounded-lg',
                        record.completed 
                          ? 'bg-success/20 text-success' 
                          : 'bg-destructive/20 text-destructive'
                      )}>
                        {record.completed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <AlertCircle className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {record.session.institution} - {record.session.turma}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(record.session.date, "d 'de' MMMM", { locale: pt })} às {record.session.startTime}
                        </p>
                        {record.observations && (
                          <p className="text-sm text-muted-foreground mt-1">
                            "{record.observations}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={record.completed ? 'default' : 'destructive'}>
                        {record.completed ? 'Realizada' : 'Não realizada'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        por {record.submittedBy.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document Preview Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Registo de Atividade
            </DialogTitle>
            <DialogDescription>
              Documento pré-preenchido com os dados da sessão selecionada.
            </DialogDescription>
          </DialogHeader>
          
          {selectedSessionData && (
            <ActivityDocumentForm 
              session={selectedSessionData}
              observations={observations}
              onDownload={handleDownloadTemplate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Registos;
