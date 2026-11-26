# Voxora 1.3 — Seu espaço, sua voz.

Login e cadastro por usuário único e senha, sem e-mail. Nome de exibição e foto são editáveis no perfil. Sessões são mantidas por cookie HttpOnly de até 400 dias, renovado ao retornar; logout, exclusão, limpeza de cookies ou troca de senha em outro dispositivo podem exigir login. Não há recuperação de senha por e-mail.

## Produção no Render

Configure `DATABASE_URL` como variável secreta do serviço, com uma conexão PostgreSQL válida (ex.: Neon com sslmode=require). Nunca publique credenciais. Use uma única instância. O backend cria a tabela `voxora_state`, armazena contas, grupos, canais, mensagens (até 500 por canal), sessões e avatares em JSONB, e aguarda a confirmação das gravações. Em produção no Render, a inicialização falha sem banco configurado. Não use banco gratuito com data de expiração. O plano gratuito de hospedagem pode dormir, mas os grupos permanecem no banco. Configure backups e acompanhe as cotas e termos do provedor. Não há garantia de retenção eterna.

Dados locais existentes, se ainda acessíveis na primeira inicialização e se o banco estiver vazio, são importados; os usuários antigos recebem identificadores derivados do e-mail, com sufixos para conflitos. Dados já apagados do disco efêmero não podem ser recuperados por essa mudança. A exclusão da conta exige a senha; grupos permanecem e a propriedade é transferida ao próximo membro (ou ao primeiro convidado futuro). Mensagens antigas são anonimizadas.

## Local

Node.js 20+: `npm install`, `npm test`, `npm start` e http://localhost:3000. Sem DATABASE_URL, dados locais ficam em data/db.json. Mantenha essa pasta privada e faça backups. Para testar PostgreSQL, use um banco isolado e não dados reais.

## Voz

WebRTC, limite de seis participantes por sala, STUN e TURN opcional via TURN_URL, TURN_USERNAME, TURN_CREDENTIAL. Compartilhamento simultâneo por todos os membros. HTTPS necessário fora de localhost. Push-to-Talk funciona com página em foco. Mídia real exige testes em navegadores.
