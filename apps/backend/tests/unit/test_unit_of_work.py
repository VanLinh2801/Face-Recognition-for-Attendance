from unittest.mock import Mock

from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork


def test_unit_of_work_commit_calls_session_commit() -> None:
    session = Mock()
    uow = SqlAlchemyUnitOfWork(session)

    uow.commit()

    session.commit.assert_called_once()


def test_unit_of_work_rolls_back_on_exception() -> None:
    session = Mock()
    uow = SqlAlchemyUnitOfWork(session)

    try:
        with uow:
            raise RuntimeError("boom")
    except RuntimeError:
        pass

    session.rollback.assert_called_once()
