# Voxora 1.2 — Seu espaço, sua voz.

Aplicação web independente para grupos persistentes, canais de voz, mensagens e compartilhamento de tela. Desenvolvida em HTML, CSS, JavaScript e Node.js, sem dependências npm externas.

## Rodar no Windows / computador

1. Instale o Node.js 20 ou superior (https://nodejs.org/).
2. Extraia o ZIP. Abra a pasta `voxora` no VS Code.
3. Abra o terminal da pasta e rode `npm start` (ou clique em `iniciar.bat` no Windows).
4. Abra http://localhost:3000 no Chrome ou Edge. Cadastre sua conta.
5. Para testar com dois usuários na mesma máquina, abra uma janela anônima e crie outra conta. Crie um grupo, copie seu convite e use-o na outra conta. Entre no mesmo canal de voz e permita o microfone. Clique em Transmitir e selecione a tela/aba/janela.

**Convites por link (v1.1):** abra um grupo e clique em `Convidar amigos` ou `Convidar`. Copie o link (por exemplo, `https://seu-site.example/?invite=CODIGO`) e envie a um amigo. Ele fará login ou cadastro, confirmará a entrada e terá o grupo salvo na conta. Também é possível colar o link ou o código em `Entrar`. Canais privados têm seu próprio link. Links de localhost só funcionam no computador que hospeda o serviço; use um endereço HTTPS público para convidar amigos de outras redes. Para sair da conta, abra o menu do perfil no canto inferior esquerdo e confirme. Sair da chamada não encerra a sessão.

O código do grupo é necessário apenas no primeiro acesso. Canais públicos ficam disponíveis aos membros; canais privados exigem seu próprio convite. O servidor salva contas, grupos, sessões e mensagens em `data/db.json`. Não publique essa pasta.

## Perfil, conta e voz (v1.2)

Abra o menu do perfil no canto inferior esquerdo ou a engrenagem no cabeçalho. Em **Meu perfil**, altere nome, biografia e foto (JPG, PNG ou WebP de até 10 MB; o navegador redimensiona para 256×256). Salve para compartilhar seu perfil com os membros dos seus grupos. Clique em um membro para ver seu perfil. Em **Minha conta**, altere e-mail e senha com a senha atual; o e-mail não aparece para outros membros. Alterar a senha desconecta as outras sessões. Não há verificação de e-mail ou recuperação de senha nesta versão.

Em **Voz e microfone**, ajuste o volume de entrada (0–200%), a sensibilidade da detecção automática e o modo de ativação: automático, Push-to-Talk ou sempre aberto. No Push-to-Talk, escolha uma tecla e segure-a enquanto fala, com o site em foco; o navegador não captura atalhos globais enquanto você está em outro aplicativo. O medidor de entrada funciona durante uma chamada. As preferências de voz são salvas por conta neste navegador, e não sincronizadas com outros dispositivos. A engrenagem da chamada abre essas configurações sem desconectar.

Todos os participantes de um canal de voz, inclusive membros comuns, podem compartilhar a tela simultaneamente, respeitando o limite de seis participantes. O servidor não exige que o participante seja dono do grupo. A captura real depende de permissão, HTTPS e compatibilidade do navegador.

Para atualizar, preserve e copie a pasta `data` inteira da versão anterior para a nova pasta `voxora` antes de iniciar. Ela também guarda as fotos de perfil. Se estiver usando `DATA_DIR`, mantenha o mesmo diretório.

## Publicar para amigos pela internet

Envie esta pasta para um repositório GitHub, sem `data/`. No Render, crie um Web Service Node apontando para o repositório. Build command: `npm install`; Start command: `npm start`. O servidor respeita a variável `PORT`. Use o endereço HTTPS do serviço para que microfone e captura de tela funcionem. `localhost` é apropriado apenas para testes na própria máquina.

**Persistência:** o arquivo JSON depende de um volume persistente. Configure um disco persistente no serviço, se disponível no seu plano, e defina `DATA_DIR` para o caminho de montagem (ex.: `/var/data`). Sem disco, os dados poderão desaparecer após reinício/redeploy. Execute apenas uma instância. Para produção, recomenda-se migrar para PostgreSQL.

**Conexões de mídia:** WebRTC usa conexões P2P e STUN por padrão. Para conexões entre redes restritas, configure um servidor TURN externo com `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` no painel do serviço. Não divulgue essas credenciais no GitHub. Em produção, prefira credenciais TURN temporárias e arquitetura SFU para grupos maiores. HTTPS é obrigatório fora de localhost. O compartilhamento de áudio da tela depende do navegador, sistema e fonte escolhida.

## Escopo e limitações

- Limite de seis conexões por canal de voz nesta versão P2P. Grupos e canais são persistentes; chamadas terminam quando os participantes se desconectam.
- Cada membro pode criar canais; o dono do canal ou grupo pode excluir canais de voz. Convites são reutilizáveis; não há revogação de convites, recuperação de senha, verificação de e-mail ou administração avançada.
- Layout adaptável a celulares, mas a transmissão de tela é voltada a navegadores desktop compatíveis.
- Testes automatizados da API: `npm test`. Cobrem contas, autorização, convites, mensagens, presença, entrada/saída de chamada e encaminhamento de sinalização. Também cobrem edição e privacidade de perfis, upload e remoção de foto, alteração de conta e permissão de transmissão simultânea por membros comuns. O teste interativo no Chromium foi bloqueado pela política do ambiente (ERR_BLOCKED_BY_ADMINISTRATOR); a interface e a mídia real ainda precisam ser verificadas no navegador local.
- Protótipo funcional para desenvolvimento, não auditado para uso público em larga escala. Não armazena nem grava as mídias no servidor.

## Arquivos

- `server.js`: servidor HTTP, API, SSE, armazenamento e sinalização WebRTC.
- `public/`: interface, estilos, cliente WebRTC e logotipo.
- `tests/api.test.js`: teste automatizado do fluxo da API.

## Deploy rápido no Render

Após enviar todos os arquivos para o GitHub, crie um Web Service no Render a partir de `tiagohiroshi775-ops/voxora`, branch `main`. A configuração `render.yaml` também permite criar um Blueprint gratuito. O plano gratuito não possui armazenamento persistente; use apenas para testes. Para manter contas e grupos em produção, configure disco persistente em um plano compatível e `DATA_DIR` para o caminho do disco.
