import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import 'dotenv/config';

export async function getFacebookSecurityCodesFromEmail({
  email,
}: {
  email: any;
}): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.EMAIL_USER_V2 || '',
      password: process.env.EMAIL_PASS_V2 || '',
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      // debug: console.log,
    });

    function openInbox(cb: any) {
      imap.openBox('INBOX', true, cb);
    }
    imap.once('ready', () => {
      openInbox((err: any, box: any) => {
        if (err) return reject(err);
        let searchCriteria = [];
        if (email) {
          searchCriteria = [
            ['FROM', 'notification@facebookmail.com'],
            ['TO', email],
            ['SUBJECT', 'Xác minh email doanh nghiệp của bạn'],
          ];
        } else {
          searchCriteria = [
            ['FROM', 'notification@facebookmail.com'],
            // ['TO', email],
            ['SUBJECT', 'Xác minh email doanh nghiệp của bạn'],
          ];
        }
        const fetchOptions = { bodies: '', markSeen: true };
        imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);
          if (!results.length) {
            imap.end();
            return resolve([]);
          }

          const codes: string[] = [];
          const parserPromises: Promise<void>[] = [];
          const f = imap.fetch(results, fetchOptions);

          f.on('message', (msg) => {
            const parserPromise = new Promise<void>((resolveParser) => {
              msg.on('body', (stream: any) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) {
                    console.error('Lỗi parse email:', err);
                    resolveParser();
                    return;
                  }

                  const text = parsed.text;
                  // console.log('text', text);
                  const matches = text?.match(/\d{6,12}/g);
                  if (matches) {
                    codes.push(...matches);
                  }
                  resolveParser();
                });
              });
            });
            parserPromises.push(parserPromise);
          });

          f.once('end', async () => {
            await Promise.all(parserPromises);
            imap.end();
            resolve(codes);
          });
        });
      });
    });

    imap.once('error', (err) => reject(err));
    imap.once('end', () => console.log('IMAP connection closed.'));
    imap.connect();
  });
}
// (async () => {
//   try {
//     const codes = await getFacebookSecurityCodesFromEmail();
//     if (codes.length === 0) {
//       console.log('Không tìm thấy mã xác thực nào.');
//     } else {
//       console.log('Danh sách mã xác thực:', codes);
//     }
//   } catch (error) {
//     console.error('Lỗi khi lấy mã xác thực:', error);
//   }
// })();
