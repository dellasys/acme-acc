import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { selectSingleDirector, selectAssigneeForRegistrationAddressChange, resolveAllOtherActiveTickets } from './ticket.helper';

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
      const result = await selectAssigneeForRegistrationAddressChange(companyId);
      assignee = result.assignee;
    } else if (type === TicketType.strikeOff) {
      category = TicketCategory.management;
      // Use helper for single director selection
      assignee = await selectSingleDirector(companyId);
      // Resolve all other active tickets for this company
      await resolveAllOtherActiveTickets(companyId);
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
