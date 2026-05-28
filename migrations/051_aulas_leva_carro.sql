-- Adiciona leva_carro à tabela aulas para registar se o mentor leva o seu carro
-- ao CONFIRMAR a sessão (em vez de apenas no registo, que é criado dias depois)
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS leva_carro BOOLEAN DEFAULT NULL;
