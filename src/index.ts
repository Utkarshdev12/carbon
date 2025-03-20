import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import  prisma  from "./prisma.js";
import { z } from 'zod';

const app = new Hono()
app.post('/students', async (c) => {
  const body = await c.req.json();
  const student = await prisma.student.create({
    data: { 
      name: body.name, 
      aadharNumber: body.aadharNumber, 
      dateOfBirth: new Date(body.dateOfBirth)
    }
  });
  return c.json(student, 201);
});
app.post('/professors', async (c) => {
  try {
    const data = z.object({
      name: z.string(),
      aadharNumber: z.string().min(12),
      seniority: z.enum(["JUNIOR", "SENIOR", "ASSOCIATE", "HEAD"]),
    }).parse(await c.req.json());

    if (await prisma.professor.findUnique({ where: { aadharNumber: data.aadharNumber } })) {
      return c.json({ error: "Professor already exists" }, 400);
    }

    return c.json(await prisma.professor.create({ data }), 201);
  } catch (error) {
    return c.json({ error: error instanceof z.ZodError ? error.errors : "Internal Server Error" }, 500);
  }
});

app.get('/students', async (c) => {
  const students = await prisma.student.findMany()
  return c.json(students)
})

app.get('/students/:id', async (c) => {
  const student = await prisma.student.findUnique({
    where: { id: c.req.param('id') }
  });
  if (!student) {
    return c.json({ error: "Student not found" }, 404);
  }
  return c.json(student);
});

app.get('/professors', async (c) => {
  const professors = await prisma.professor.findMany()
  return c.json(professors)
});
app.patch('/students/:id', async (c) => {
  const student = await prisma.student.findUnique({
    where: { id: c.req.param('id') }
  });
  if (!student) {
    return c.json({ error: "Student not found" }, 404);
  }
  const body = await c.req.json();
  const updatedStudent = await prisma.student.update({
    where: { id: student.id },
    data: {
      name: body.name || student.name,
      aadharNumber: body.aadharNumber || student.aadharNumber,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : student.dateOfBirth
    }
  });
  return c.json(updatedStudent);
});
app.patch('/professors/:id', async (c) => {
  const professor = await prisma.professor.findUnique({
    where: { id: c.req.param('id') }
  });
  if (!professor) {
    return c.json({ error: "Professor not found" }, 404);
  }
  const body = await c.req.json();
  const updatedProfessor = await prisma.professor.update({
    where: { id: professor.id },
    data: {
      name: body.name || professor.name,
      aadharNumber: body.aadharNumber || professor.aadharNumber,
      seniority: body.seniority || professor.seniority
    }
  });
  return c.json(updatedProfessor);
});
app.post('/professors/:professorId/proctorships', async (c) => {
  const { professorId } = c.req.param();
  const body = await c.req.json();
  const student = await prisma.student.findUnique({
    where: { id: body.studentId }
  });
  if (!student) {
    return c.json({ error: "Student not found" }, 404);
  }
  const proctorship = await prisma.student.update({
    where: { id: student.id },
    data: { proctorId: professorId }
  });
  return c.json(proctorship);
});
app.get('/professors/:professorId/proctorships', async (c) => {
  const { professorId } = c.req.param();
  const proctorships = await prisma.student.findMany({
    where: { proctorId: professorId },
  });
  return c.json(proctorships);
});
app.delete('/students/:id', async (c) => {
  const student = await prisma.student.findUnique({
    where: { id: c.req.param('id') }
  });
  if (!student) {
    return c.json({ error: "Student not found" }, 404);
  }
  await prisma.student.delete({ where: { id: student.id } });
  return c.json({ message: "Student deleted" });
});
app.delete('/professors/:id', async (c) => {
  const professor = await prisma.professor.findUnique({
    where: { id: c.req.param('id') }
  });
  if (!professor) {
    return c.json({ error: "Professor not found" }, 404);
  }
  await prisma.professor.delete({ where: { id: professor.id } });
  return c.json({ message: "Professor deleted" });
}
);
app.get('/students/:studentId/library-membership', async (c) => {
  const { studentId } = c.req.param();
  const membership = await prisma.libraryMembership.findUnique({
    where: { studentId },
  });
  return c.json(membership);
});

app.post('/students/:studentId/library-membership', async (c) => {
  try {
    const studentId = c.req.param("studentId");

    // Accept string format for issueDate and expiryDate
    const { issueDate, expiryDate } = z.object({
      issueDate: z.string(),
      expiryDate: z.string(),
    }).parse(await c.req.json());

    // Check if a membership already exists
    const existingMembership = await prisma.libraryMembership.findUnique({
      where: { studentId },
    });

    if (existingMembership) {
      return c.json({ error: "Library membership already exists for this student" }, 400);
    }

    // Convert to Date objects
    const parsedIssueDate = new Date(`${issueDate}T00:00:00.000Z`);
    const parsedExpiryDate = new Date(`${expiryDate}T00:00:00.000Z`);

    // Create the membership
    const newMembership = await prisma.libraryMembership.create({
      data: {
        studentId,
        issueDate: parsedIssueDate,
        expiryDate: parsedExpiryDate,
      },
    });

    return c.json(newMembership, 201);
  } catch (error) {
    return c.json({ error: error instanceof z.ZodError ? error.errors : "Internal Server Error" }, 500);
  }
});

app.get('/students/:studentId/library-membership', async (c) => {
  const { studentId } = c.req.param();
  const membership = await prisma.libraryMembership.findUnique({
    where: { studentId },
  });
  return c.json(membership);
});
app.patch('/students/:studentId/library-membership', async (c) => {
  try {
    const studentId = c.req.param('studentId')
    const data = await c.req.json()

    // If expiryDate or issueDate exists, convert to Date
    if (data.issueDate) {
      data.issueDate = new Date(data.issueDate)
    }
    if (data.expiryDate) {
      data.expiryDate = new Date(data.expiryDate)
    }

    // Update membership
    const updatedMembership = await prisma.libraryMembership.update({
      where: { studentId },
      data,
    })

    return c.json(updatedMembership)
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
})

app.delete('/students/:studentId/library-membership', async (c) => {
  const { studentId } = c.req.param();
  const membership = await prisma.libraryMembership.findUnique({
    where: { studentId },
  });
  if (!membership) {
    return c.json({ error: "Library membership does not exist for this student" }, 404);
  }
  await prisma.libraryMembership.delete({
    where: { studentId },
  });
  return c.json({ message: "Library membership deleted" });
});



serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})