import { ConflictException } from '@nestjs/common';
import { User, UserRole } from '../../db/models/User';
import { Ticket, TicketStatus, TicketType } from '../../db/models/Ticket';
import { Op } from 'sequelize';

/**
   * Resolves all open tickets for a company except strikeOff tickets.
   */
export const resolveAllOtherActiveTickets = async (companyId: number) => {
    await Ticket.update(
        { status: TicketStatus.resolved },
        {
            where: {
                companyId,
                status: TicketStatus.open,
                type: { [Op.ne]: TicketType.strikeOff },
            },
        }
    );
}


/**
 * Selects the only director for a company. Throws if none or multiple found.
 */
export const selectSingleDirector = async (companyId: number): Promise<User> => {
    const directors = await User.findAll({
        where: { companyId, role: UserRole.director },
        order: [['createdAt', 'DESC']],
    });
    if (directors.length === 0) {
        throw new ConflictException(
            `Cannot find user with role director to create a strikeOff ticket`,
        );
    }
    if (directors.length > 1) {
        throw new ConflictException(
            `Multiple users with role director. Cannot create a strikeOff ticket`,
        );
    }
    return directors[0];
}

/**
   * Selects the assignee for a registrationAddressChange ticket.
   * Priority: Corporate Secretary (only one allowed), then Director (only one allowed).
   * Throws if none or multiple found.
   */
export const selectAssigneeForRegistrationAddressChange = async (companyId: number): Promise<{ assignee: User, role: UserRole }> => {
    // Try to find a single corporate secretary
    const secretaries = await User.findAll({
        where: { companyId, role: UserRole.corporateSecretary },
        order: [['createdAt', 'DESC']],
    });
    if (secretaries.length === 1) {
        return { assignee: secretaries[0], role: UserRole.corporateSecretary };
    }
    if (secretaries.length > 1) {
        throw new ConflictException(
            `Multiple users with role corporateSecretary. Cannot create a ticket`,
        );
    }
    // Fallback to director
    const directors = await User.findAll({
        where: { companyId, role: UserRole.director },
        order: [['createdAt', 'DESC']],
    });
    if (directors.length === 1) {
        return { assignee: directors[0], role: UserRole.director };
    }
    if (directors.length > 1) {
        throw new ConflictException(
            `Multiple users with role director. Cannot create a ticket`,
        );
    }
    throw new ConflictException(
        `Cannot find user with role corporateSecretary or director to create a ticket`,
    );
}