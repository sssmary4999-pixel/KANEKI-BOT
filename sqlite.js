import { DatabaseSync } from "node:sqlite";

/**
 * غلاف حول node:sqlite يكشف الجزء المستخدم من واجهة better-sqlite3
 * (`pragma` و`exec` و`prepare().get/all/run` و`transaction`).
 *
 * node:sqlite مدمج في Node نفسه، فلا خطوة بناء أصلية ولا تعارض ثنائيات
 * مُسبقة البناء — وبهذا تختفي فئة كاملة من أعطال التثبيت.
 */
export function openDatabase(dbPath, { readonly = false } = {}) {
  const db = readonly ? new DatabaseSync(dbPath, { readOnly: true }) : new DatabaseSync(dbPath);

  return {
    exec: (sql) => db.exec(sql),

    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        get: (...args) => stmt.get(...args),
        all: (...args) => stmt.all(...args),
        run: (...args) => stmt.run(...args),
      };
    },

    pragma: (expr) => {
      try {
        db.exec(`PRAGMA ${expr}`);
      } catch {
        // إعداد pragma غير مدعوم — وليس قاتلاً أبداً.
      }
    },

    transaction: (fn) => (...args) => {
      db.exec("BEGIN");
      try {
        const result = fn(...args);
        db.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {}
        throw err;
      }
    },

    close: () => {
      try {
        db.close();
      } catch {}
    },
  };
}
