export type SupportContact = {
  id: string;
  nameKey: string;
  roleKey: string;
  phone: string;
  descriptionKey?: string;
};

export const SUPPORT_CONTACTS: SupportContact[] = [
  {
    id: "mentor-1",
    nameKey: "supportContactStudentMentor",
    roleKey: "supportContactMentorRole",
    phone: "+77000000001",
    descriptionKey: "supportContactStudentMentorDesc",
  },
  {
    id: "therapist-1",
    nameKey: "supportContactTherapist",
    roleKey: "supportContactTherapistRole",
    phone: "+77000000002",
    descriptionKey: "supportContactTherapistDesc",
  },
  {
    id: "support-1",
    nameKey: "supportContactUniversityOffice",
    roleKey: "supportContactOfficeRole",
    phone: "+77000000003",
    descriptionKey: "supportContactUniversityOfficeDesc",
  },
];
