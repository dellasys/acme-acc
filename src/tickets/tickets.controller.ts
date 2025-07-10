import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  /**
   * Selects the assignee for a registrationAddressChange ticket.
   * Priority: Corporate Secretary (only one allowed), then Director (only one allowed).
   * Throws if none or multiple found.
   */
  private async selectAssigneeForRegistrationAddressChange(companyId: number): Promise<{ assignee: User, role: UserRole }> {
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

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    if (type === TicketType.registrationAddressChange) {
      const existing = await Ticket.findOne({
        where: { companyId, type: TicketType.registrationAddressChange },
      });
      if (existing) {
        throw new ConflictException(
          `A registrationAddressChange ticket already exists for this company.`
        );
      }
    }

    let category: TicketCategory;
    let assignee: User;

    if (type === TicketType.managementReport) {
      category = TicketCategory.accounting;
      // Find all accountants, pick the most recently created
      const accountants = await User.findAll({
        where: { companyId, role: UserRole.accountant },
        order: [['createdAt', 'DESC']],
      });
      if (!accountants.length) {
        throw new ConflictException(
          `Cannot find user with role accountant to create a ticket`,
        );
      }
      assignee = accountants[0];
    } else if (type === TicketType.registrationAddressChange) {
      category = TicketCategory.corporate;
      // Use helper for secretary/director logic
      const result = await this.selectAssigneeForRegistrationAddressChange(companyId);
      assignee = result.assignee;
    } else {
      // Default/future ticket types
      throw new ConflictException('Unsupported ticket type');
    }

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
