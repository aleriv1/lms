import { Link } from "react-router-dom";

import { Loader } from "../components/ui";
import { ROLE_LABELS } from "../components/layout/navItems";
import { ProfileStatistics } from "../features/statistics/ProfileStatistics";
import { useAppSelector } from "../store/hooks";
import styles from "./ProfilePage.module.css";

export function ProfilePage() {
  const user = useAppSelector((state) => state.auth.user);

  if (!user) {
    return <Loader />;
  }

  return (
    <section>
      <div className={styles.header}>
        <div>
          <h1>Личный кабинет</h1>
          <p>Основная информация учетной записи</p>
        </div>
        <Link className={styles.editLink} to="/profile/edit">
          Редактировать профиль
        </Link>
      </div>
      <dl className={styles.identity}>
        <div className={styles.row}>
          <dt>Имя</dt>
          <dd>{user.name}</dd>
        </div>
        <div className={styles.row}>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div className={styles.row}>
          <dt>Роль</dt>
          <dd>{ROLE_LABELS[user.role]}</dd>
        </div>
        <div className={styles.row}>
          <dt>Группа</dt>
          <dd>{user.groupName ?? "Не указана"}</dd>
        </div>
      </dl>
      <ProfileStatistics key={user.id} />
    </section>
  );
}
